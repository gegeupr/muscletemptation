const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
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
      success_url: 'https://muscletemptation.online/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://muscletemptation.online/',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Erro ao criar a sessão de checkout:', error);
    res.status(500).json({ error: 'Erro ao criar a sessão de checkout.' });
  }
};