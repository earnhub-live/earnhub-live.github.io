
CREATE OR REPLACE FUNCTION public.approve_task_submission(p_submission_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_submission public.task_submissions%ROWTYPE;
    v_task public.tasks%ROWTYPE;
    v_reward NUMERIC(12,2);
    v_rows INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT *
    INTO v_submission
    FROM public.task_submissions
    WHERE id = p_submission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    IF v_submission.status <> 'pending' THEN
        RAISE EXCEPTION 'This submission has already been reviewed';
    END IF;

    SELECT *
    INTO v_task
    FROM public.tasks
    WHERE id = v_submission.task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    IF v_task.task_type = 'normal' THEN
        v_reward := 50.00;

    ELSIF v_task.task_type = 'sponsored' THEN

        IF NOT v_task.payment_verified OR NOT v_task.is_active THEN
            RAISE EXCEPTION 'Sponsored campaign is not active or payment is not verified';
        END IF;

        IF v_task.campaign_start_at IS NULL
           OR v_task.campaign_end_at IS NULL
           OR v_task.campaign_start_at > pg_catalog.now()
           OR v_task.campaign_end_at <= pg_catalog.now() THEN
            RAISE EXCEPTION 'Sponsored campaign is outside its active dates';
        END IF;

        IF v_task.remaining_slots IS NULL
           OR v_task.remaining_slots <= 0 THEN
            RAISE EXCEPTION 'No campaign slots remaining';
        END IF;

        v_reward := v_task.reward;

        IF v_reward IS NULL OR v_reward <= 0 THEN
            RAISE EXCEPTION 'Invalid sponsored task reward';
        END IF;

        IF v_task.budget_remaining IS NULL
           OR v_task.budget_remaining < v_reward THEN
            RAISE EXCEPTION 'Insufficient campaign budget';
        END IF;

        UPDATE public.tasks
        SET
            budget_remaining = budget_remaining - v_reward,
            remaining_slots = remaining_slots - 1,
            is_active = CASE
                WHEN remaining_slots - 1 <= 0
                  OR budget_remaining - v_reward < reward
                THEN false
                ELSE true
            END
        WHERE id = v_task.id;

    ELSE
        RAISE EXCEPTION 'Invalid task type';
    END IF;

    UPDATE public.profiles
    SET
        available_balance = available_balance + v_reward,
        total_earnings = total_earnings + v_reward,
        completed_tasks = completed_tasks + 1
    WHERE id = v_submission.user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    UPDATE public.task_submissions
    SET
        status = 'approved',
        reviewed_at = pg_catalog.now()
    WHERE id = p_submission_id;

    INSERT INTO public.wallet_transactions (
        user_id,
        submission_id,
        amount,
        transaction_type
    )
    VALUES (
        v_submission.user_id,
        p_submission_id,
        v_reward,
        'task_reward'
    );

    RETURN 'Task approved and Rs. ' || v_reward::text || ' reward credited';

END;
$function$;
