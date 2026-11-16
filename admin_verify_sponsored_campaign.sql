
CREATE OR REPLACE FUNCTION public.admin_verify_sponsored_campaign(p_task_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_task public.tasks%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT *
    INTO v_task
    FROM public.tasks
    WHERE id = p_task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign not found';
    END IF;

    IF v_task.task_type <> 'sponsored' THEN
        RAISE EXCEPTION 'This is not a sponsored campaign';
    END IF;

    IF v_task.payment_verified THEN
        RAISE EXCEPTION 'Payment already verified';
    END IF;

    IF NULLIF(TRIM(v_task.sponsor_company), '') IS NULL
       OR NULLIF(TRIM(v_task.sponsor_payment_reference), '') IS NULL THEN
        RAISE EXCEPTION 'Sponsor company and payment reference are required';
    END IF;

    IF v_task.sponsor_payment_amount IS NULL
       OR v_task.sponsor_payment_amount <= 0
       OR v_task.reward IS NULL
       OR v_task.reward <= 0
       OR v_task.total_slots IS NULL
       OR v_task.total_slots <= 0 THEN
        RAISE EXCEPTION 'Invalid payment, reward, or slot details';
    END IF;

    IF v_task.campaign_budget IS DISTINCT FROM
       ROUND(v_task.sponsor_payment_amount * 0.70, 2)
       OR v_task.company_revenue_amount IS DISTINCT FROM
       ROUND(v_task.sponsor_payment_amount * 0.30, 2) THEN
        RAISE EXCEPTION '70/30 payment allocation is incorrect';
    END IF;

    IF v_task.budget_remaining IS DISTINCT FROM v_task.campaign_budget
       OR v_task.remaining_slots IS DISTINCT FROM v_task.total_slots THEN
        RAISE EXCEPTION 'Initial budget or slot values are incorrect';
    END IF;

    IF v_task.reward * v_task.total_slots > v_task.campaign_budget THEN
        RAISE EXCEPTION 'Campaign rewards exceed available budget';
    END IF;

    IF v_task.campaign_start_at IS NULL
       OR v_task.campaign_end_at IS NULL
       OR v_task.campaign_start_at > pg_catalog.now()
       OR v_task.campaign_end_at <= pg_catalog.now()
       OR v_task.campaign_end_at <= v_task.campaign_start_at THEN
        RAISE EXCEPTION 'Campaign dates are invalid or outside the active period';
    END IF;

    UPDATE public.tasks
    SET
        payment_verified = true,
        payment_verified_by = auth.uid(),
        payment_verified_at = pg_catalog.now(),
        is_active = true
    WHERE id = p_task_id;

    RETURN 'Payment verified and sponsored campaign published successfully';
END;
$function$;
