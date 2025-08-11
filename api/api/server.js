const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

// Substitua com a sua Chave Secreta do Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint para criar a sessão de checkout
app.post('/create-checkout-session', async (req, res) => {
  const { priceId } = req.body;
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
      cancel_url: 'https://muscletemptation.online/index.html',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Erro ao criar a sessão de checkout:', error);
    res.status(500).json({ error: 'Erro ao criar a sessão de checkout.' });
  }
});

// Endpoint para verificar a assinatura (usaremos em breve)
app.post('/verify-subscription', async (req, res) => {
  // Lógica para verificar o status da assinatura com o Stripe
  // Por enquanto, vamos deixar este endpoint como um placeholder
  res.status(200).json({ message: 'Verificação em desenvolvimento.' });
});

module.exports = app;