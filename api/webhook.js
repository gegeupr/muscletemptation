const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
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

      // Crie o perfil no Supabase
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert([{
          email: userEmail,
          stripe_customer_id: session.customer,
          subscription_status: 'active'
        }]);

      if (profileError) throw profileError;

      // Crie o usuário e o Supabase enviará o e-mail de confirmação
      const { data: userData, error: authError } = await supabase.auth.signUp({
        email: userEmail,
        password: temporaryPassword,
      });

      if (authError) throw authError;

      console.log(`Novo usuário criado no Supabase: ${userEmail}. E-mail de confirmação enviado.`);

    } catch (dbError) {
      console.error("Erro ao processar o webhook:", dbError);
    }
  }

  res.status(200).json({ received: true });
};