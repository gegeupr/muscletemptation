const express = require('express');
const cors = require('cors');
const path = require('path');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Chaves de API do Stripe (LIVE)
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY; // A nova chave do webhook

// Middleware para processar os webhooks
app.use(express.json({
  verify: function (req, res, buf) {
    if (req.originalUrl.startsWith('/api/webhook')) {
      req.rawBody = buf.toString();
    }
  },
}));

app.use(cors());

// Servindo os arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para criar a sessão de checkout
app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'Price ID is required' });
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
      success_url: 'https://muscletemptation.online/success.html',
      cancel_url: 'https://muscletemptation.online/',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Erro ao criar a sessão de checkout:', error);
    res.status(500).json({ error: 'Erro ao criar a sessão de checkout.' });
  }
});

// Endpoint para receber os webhooks do Stripe
app.post('/api/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Erro na verificação do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Lógica para processar os eventos
  switch (event.type) {
    case 'checkout.session.completed':
      // O fã pagou! Aqui você enviaria o email com o link de acesso.
      const session = event.data.object;
      console.log(`Assinatura completa para o cliente: ${session.customer}`);
      // Lógica para enviar email com link mágico, etc.
      break;
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      console.log(`Assinatura do cliente ${subscription.customer} foi cancelada.`);
      // Lógica para remover acesso
      break;
    default:
      console.log(`Evento não tratado: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// Iniciando o servidor
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});