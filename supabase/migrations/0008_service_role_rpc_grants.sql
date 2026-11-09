-- Server API functions use the service-role key. Grant only the payment and
-- prize-assignment RPCs required by those functions.
grant execute on function public.mark_order_paid(text, text) to service_role;
grant execute on function public.mark_order_payment_failed(text, text) to service_role;
grant execute on function public.assign_prize_to_customer(uuid, uuid, text, text) to service_role;
grant execute on function public.release_prize_assignment(uuid) to service_role;
