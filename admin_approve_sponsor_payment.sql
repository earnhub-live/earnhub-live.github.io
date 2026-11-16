
CREATE OR REPLACE FUNCTION public.admin_approve_sponsor_payment(p_payment_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_payment public.sponsor_payments%ROWTYPE;
    v_task public.tasks%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT *
    INTO v_payment
    FROM public.sponsor_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sponsor payment not found';
    END IF;

    IF v_payment.payment_status <> 'pending' THEN
        RAISE EXCEPTION 'Payment already reviewed';
    END IF;

    SELECT *
    INTO v_task
    FROM public.tasks
    WHERE id = v_payment.task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign not found';
    END IF;

    IF v_task.sponsor_id IS DISTINCT FROM v_payment.sponsor_id
       OR v_task.task_type <> 'sponsored'
       OR v_task.payment_verified
       OR v_task.is_active THEN
        RAISE EXCEPTION 'Invalid sponsor campaign';
    END IF;

    IF v_task.sponsor_payment_amount
       IS DISTINCT FROM v_payment.payment_amount THEN
        RAISE EXCEPTION 'Payment amount mismatch';
    END IF;

    IF v_task.sponsor_company
       IS DISTINCT FROM v_payment.sponsor_company THEN
        RAISE EXCEPTION 'Sponsor company mismatch';
    END IF;

    UPDATE public.sponsor_payments
    SET
        payment_status = 'verified',
        verified_at = pg_catalog.now(),
        verified_by = (SELECT auth.uid())
    WHERE id = p_payment_id;

    PERFORM public.admin_verify_sponsored_campaign(
        v_payment.task_id
    );

    RETURN 'Payment verified and campaign published successfully';
END;
$function$;
