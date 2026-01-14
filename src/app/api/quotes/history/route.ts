import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const { data, error } = await supabaseAdmin
    .from('quotes')
    .select('id, topic, persona, tone, language, style, quote_type, image_quotes, hook, word_limit, quotes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    const needsMigration = String(error.message).toLowerCase().includes('quote_type');
    const response = NextResponse.json(
      {
        error: needsMigration
          ? 'Database missing quote_type column on quotes table. Please run ALTER TABLE to add it.'
          : 'Unable to load quotes',
      },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  const quotes = data ?? [];
  const quoteIds = quotes.map((row) => row.id).filter(Boolean);
  let publishJobs: Record<
    string,
    { status: string; scheduled_at: string | null; updated_at: string | null; attempts: number | null; last_error: string | null }
  > = {};

  if (quoteIds.length > 0) {
    const { data: jobs } = await supabaseAdmin
      .from('publish_jobs')
      .select('entity_id, status, scheduled_at, updated_at, attempts, last_error, created_at')
      .eq('user_id', user.id)
      .eq('entity_type', 'quote')
      .in('entity_id', quoteIds)
      .order('created_at', { ascending: false });

    if (jobs) {
      for (const job of jobs) {
        const entityId = job.entity_id as string;
        if (!publishJobs[entityId]) {
          publishJobs[entityId] = {
            status: job.status as string,
            scheduled_at: job.scheduled_at ?? null,
            updated_at: job.updated_at ?? job.created_at ?? null,
            attempts: job.attempts ?? null,
            last_error: job.last_error ?? null,
          };
        }
      }
    }
  }

  const response = NextResponse.json({ quotes, publishJobs });
  applyCookies(response);
  return response;
}
