-- 由伺服器 service_role 呼叫；函式內的所有寫入在同一交易完成。
create or replace function public.save_client_questionnaire(
  p_referral_code text,
  p_submission_token text,
  p_auth_user_id uuid,
  p_data jsonb,
  p_asset_breakdown jsonb,
  p_protection_vs_invest jsonb,
  p_gaps jsonb,
  p_lead_score jsonb,
  p_pdpa_version text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_advisor_id uuid;
  v_client_id uuid;
begin
  select id into v_advisor_id from public.advisors
    where referral_code = upper(trim(p_referral_code));
  if v_advisor_id is null then raise exception 'INVALID_REFERRAL'; end if;

  insert into public.clients (
    advisor_id, surname, honorific, line_id, mobile, email,
    pdpa_consent, pdpa_consent_at, pdpa_version, submission_token
  ) values (
    v_advisor_id, p_data #>> '{basic,surname}', p_data #>> '{basic,honorific}',
    p_data #>> '{basic,line_id}', p_data #>> '{basic,mobile}', p_data #>> '{basic,email}',
    true, now(), p_pdpa_version, p_submission_token
  )
  on conflict (advisor_id, submission_token) where submission_token is not null
  do update set
    surname = excluded.surname,
    honorific = excluded.honorific,
    line_id = excluded.line_id,
    mobile = excluded.mobile,
    email = excluded.email
  where clients.auth_user_id is null or clients.auth_user_id = p_auth_user_id
  returning id into v_client_id;

  if v_client_id is null then raise exception 'CLIENT_ALREADY_LINKED'; end if;

  insert into public.questionnaire_responses (client_id, basic, core, deep, kyc, updated_at)
  values (v_client_id, p_data->'basic', p_data->'core', p_data->'deep', p_data->'kyc', now())
  on conflict (client_id) do update set
    basic = excluded.basic, core = excluded.core, deep = excluded.deep,
    kyc = excluded.kyc, updated_at = now();

  insert into public.client_summaries
    (client_id, asset_breakdown, protection_vs_invest, gaps, computed_at)
  values (v_client_id, p_asset_breakdown, p_protection_vs_invest, p_gaps, now())
  on conflict (client_id) do update set
    asset_breakdown = excluded.asset_breakdown,
    protection_vs_invest = excluded.protection_vs_invest,
    gaps = excluded.gaps, computed_at = now();

  insert into public.advisor_private (client_id, lead_score)
  values (v_client_id, p_lead_score)
  on conflict (client_id) do update set lead_score = excluded.lead_score;

  return v_client_id;
end;
$$;

revoke all on function public.save_client_questionnaire(text,text,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_client_questionnaire(text,text,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text) to service_role;
