const express = require('express');
const cors = require('cors');
const path = require('path');
const Stripe = require('stripe');
const fs = require('fs').promises; // Usamos a versão de 'promessas' do 'fs' para código mais limpo

// --- CONFIGURAÇÃO INICIAL ---
const app = express();
const PORT = process.env.PORT || 3000;
const USERS_DB_PATH = path.join(__dirname, 'users.json');

// --- CHAVES DE API (Mantenha em variáveis de ambiente) ---
// Use suas chaves de TESTE durante o desenvolvimento.
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;

// --- MIDDLEWARE ---
// Middleware do Stripe para processar o corpo do webhook DEVE VIR ANTES do express.json() global
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Erro na verificação do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // --- LÓGICA DO WEBHOOK ---
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('✅ Sessão de checkout completa!');
      
      try {
        const usersData = await fs.readFile(USERS_DB_PATH, 'utf8');
        const users = JSON.parse(usersData);

        const customer = await stripe.customers.retrieve(session.customer);
        const userEmail = customer.email;

        const userIndex = users.findIndex(user => user.email === userEmail);
        
        if (userIndex === -1) {
          // Usuário não existe, vamos criar um novo
          const newUser = {
            email: userEmail,
            password: Math.random().toString(36).slice(-8), // Gera senha aleatória de 8 dígitos
            stripeCustomerId: session.customer,
            activeSubscription: true
          };
          users.push(newUser);
          console.log(`✨ Novo usuário criado: ${userEmail}. Senha Provisória: ${newUser.password}`);
          // !! IMPORTANTE: AQUI VOCÊ DEVE ENVIAR UM EMAIL PARA O USUÁRIO COM A SENHA !!
        } else {
          // Usuário já existe, reativar a assinatura
          users[userIndex].activeSubscription = true;
          console.log(`✅ Assinatura reativada para o usuário: ${userEmail}`);
        }

        await fs.writeFile(USERS_DB_PATH, JSON.stringify(users, null, 2));

      } catch (dbError) {
          console.error("❌ Erro ao acessar o banco de dados de usuários:", dbError);
      }
      break;

    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      console.log(`❗ Assinatura cancelada para o cliente: ${subscription.customer}`);
      
      try {
          const usersData = await fs.readFile(USERS_DB_PATH, 'utf8');
          const users = JSON.parse(usersData);

          const userIndex = users.findIndex(user => user.stripeCustomerId === subscription.customer);

          if (userIndex !== -1) {
              users[userIndex].activeSubscription = false;
              await fs.writeFile(USERS_DB_PATH, JSON.stringify(users, null, 2));
              console.log(`🔑 Acesso removido para o usuário com ID de cliente: ${subscription.customer}`);
          }
      } catch (dbError) {
          console.error("❌ Erro ao remover acesso do usuário:", dbError);
      }
      break;

    default:
      console.log(`Evento não tratado: ${event.type}`);
  }

  res.status(200).json({ received: true });
});


// Middleware para processar JSON em outras rotas
app.use(express.json());
app.use(cors());

// Servindo os arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));


// --- ROTAS DA API ---

// Endpoint para criar a sessão de checkout
app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'Price ID é obrigatório' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Certifique-se que o email do cliente é coletado
      customer_creation: 'always',
      success_url: `${req.headers.origin}/success.html`, // URL de sucesso dinâmica
      cancel_url: `${req.headers.origin}/`, // URL de cancelamento dinâmica
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('❌ Erro ao criar a sessão de checkout:', error);
    res.status(500).json({ error: 'Erro ao criar a sessão de checkout.' });
  }
});


// Endpoint para processar o login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
        const usersData = await fs.readFile(USERS_DB_PATH, 'utf8');
        const users = JSON.parse(usersData);
        
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            if (user.activeSubscription) {
              // Login bem-sucedido e assinatura ativa
              res.status(200).json({ message: 'Login bem-sucedido!', token: `fake-token-for-${email}` });
            } else {
              // Usuário existe mas a assinatura está inativa
              res.status(403).json({ error: 'Sua assinatura não está ativa. Por favor, renove seu plano.' });
            }
        } else {
            // Login falhou (usuário ou senha incorretos)
            res.status(401).json({ error: 'Email ou senha inválidos.' });
        }
    } catch (dbError) {
        console.error("❌ Erro ao processar o login:", dbError);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});


// --- INICIANDO O SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});