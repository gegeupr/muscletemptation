const express = require('express');
const cors = require('cors');
const path = require('path');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());

// Servindo os arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para a página inicial (servindo o index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para criar a sessão de checkout
app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId } = req.body;
  if (!priceId) {
    return res.status(400).json({ error: 'Price ID is required' });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://muscletemptation.online/success.html',
      cancel_url: 'https://muscletemptation.online/',
    });
    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar a sessão de checkout.' });
  }
});

app.post('/api/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const userEmail = session.customer_details.email;
      const temporaryPassword = crypto.randomBytes(8).toString('hex');
      const hashedPassword = crypto.createHash('sha256').update(temporaryPassword).digest('hex');

      const { data, error } = await supabase
        .from('profiles')
        .insert([{ 
          email: userEmail, 
          password_hash: hashedPassword, 
          stripe_customer_id: session.customer, 
          subscription_status: 'active' 
        }]);

      if (error) throw error;

      const emailSubject = 'Sua conta MuscleTemptation foi criada!';
      const emailText = `Olá!\nSua assinatura foi confirmada. Use as credenciais abaixo para fazer login:\nEmail: ${userEmail}\nSenha temporária: ${temporaryPassword}`;

      let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      let mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: emailSubject,
        text: emailText
      };

      await transporter.sendMail(mailOptions);

      console.log(`Novo usuário criado no Supabase: ${userEmail}. E-mail de boas-vindas enviado.`);
    } catch (dbError) {
      console.error("Erro ao processar o webhook:", dbError);
    }
  }
  res.status(200).json({ received: true });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
        const { data: user, error: loginError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (loginError) throw loginError;

        res.status(200).json({ message: 'Login bem-sucedido!', user });

    } catch (dbError) {
        res.status(401).json({ error: 'Email ou senha inválidos.' });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});