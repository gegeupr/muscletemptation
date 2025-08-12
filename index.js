const express = require('express');
const cors = require('cors');
const path = require('path');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

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
      
      const { data: userData, error: authError } = await supabase.auth.signUp({
        email: userEmail,
        password: Math.random().toString(36).slice(-8) // Senha temporária, o Supabase enviará o link
      });

      if (authError) throw authError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([{ 
          email: userEmail, 
          stripe_customer_id: session.customer, 
          subscription_status: 'active' 
        }]);

      if (profileError) throw profileError;

      console.log(`Novo usuário criado no Supabase: ${userEmail}. Um e-mail de confirmação foi enviado.`);

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