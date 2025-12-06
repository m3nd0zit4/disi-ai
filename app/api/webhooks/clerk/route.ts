// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent, UserJSON } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';

// Cliente HTTP de Convex (puede llamar funciones internas desde el servidor)
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error: Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new NextResponse('Error: Verification failed', { status: 400 });
  }

  const eventType = evt.type;

  try {
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;

      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;

      case 'user.deleted':
        if (evt.data.id) {
          await handleUserDeleted(evt.data.id);
        }
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Error: Processing failed', { status: 500 });
  }
}

// ===== HANDLERS =====

async function handleUserCreated(data: UserJSON) {
  console.log('Creating user in Convex:', data.id);

  await convex.mutation(api.users.createUser, {
    clerkId: data.id,
    email: data.email_addresses[0]?.email_address || '',
    name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Usuario',
    imageUrl: data.image_url || undefined,
    token: process.env.CLERK_WEBHOOK_SECRET!,
  });
}

async function handleUserUpdated(data: UserJSON) {
  console.log('Updating user in Convex:', data.id);

  await convex.mutation(api.users.updateUser, {
    clerkId: data.id,
    email: data.email_addresses[0]?.email_address || '',
    name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Usuario',
    imageUrl: data.image_url || undefined,
    token: process.env.CLERK_WEBHOOK_SECRET!,
  });
}

async function handleUserDeleted(userId: string) {
  console.log('Deleting user in Convex:', userId);

  await convex.mutation(api.users.deleteUser, {
    clerkId: userId,
    token: process.env.CLERK_WEBHOOK_SECRET!,
  });
}