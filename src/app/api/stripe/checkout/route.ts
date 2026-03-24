import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

// Subscription price IDs by monthly amount
const SUBSCRIPTION_PRICES: Record<number, string> = {
  3: 'price_1TEe9xL2RuEk60FmrNEgp2LL',
  4: 'price_1TEeMkL2RuEk60FmcycGfrSl',
  5: 'price_1TEeNCL2RuEk60FmhwJt8yMU',
}

const DONATION_PRODUCT_ID = 'prod_UD4KUXFXTSL9ii'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://communitrade.app'

export async function POST(req: NextRequest) {
  try {
    const { type, amount, userId, userEmail } = await req.json()

    if (type === 'subscription') {
      const monthlyAmount = Math.round(amount) as 3 | 4 | 5
      const priceId = SUBSCRIPTION_PRICES[monthlyAmount]
      if (!priceId) {
        return NextResponse.json({ error: 'Invalid subscription amount' }, { status: 400 })
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}?support=success`,
        cancel_url: `${APP_URL}?page=support`,
        customer_email: userEmail || undefined,
        metadata: { userId: userId || '', type: 'subscription', amount: String(monthlyAmount) },
      })
      return NextResponse.json({ url: session.url })
    }

    if (type === 'donation') {
      if (!amount || amount < 1) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product: DONATION_PRODUCT_ID,
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        success_url: `${APP_URL}?support=success`,
        cancel_url: `${APP_URL}?page=support`,
        customer_email: userEmail || undefined,
        metadata: { userId: userId || '', type: 'donation', amount: String(amount) },
      })
      return NextResponse.json({ url: session.url })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (err: unknown) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 500 }
    )
  }
}
