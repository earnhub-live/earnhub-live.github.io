
CREATE OR REPLACE FUNCTION public.enforce_fixed_task_reward()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF NEW.task_type = 'normal' THEN
        NEW.reward := 50.00;

    ELSIF NEW.task_type = 'sponsored' THEN
        IF NEW.reward IS NULL OR NEW.reward <= 0 THEN
            RAISE EXCEPTION 'Sponsored task reward must be greater than zero';
        END IF;

    ELSE
        RAISE EXCEPTION 'Invalid task type';
    END IF;

    RETURN NEW;
END;
$function$;
