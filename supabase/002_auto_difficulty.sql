-- Clasificación automática inicial de dificultad para las preguntas existentes
-- de Buensoft Evalua (no modifica public.questions, solo llena trivia_question_meta).
--   * verdadero_falso -> 'facil'
--   * opcion_multiple corta/estándar -> 'media'
--   * opcion_multiple extensa/técnica -> 'dificil'

insert into public.trivia_question_meta (question_id, difficulty, prompt_hash, updated_at)
select
  q.id,
  case
    when q.qtype = 'verdadero_falso' then 'facil'
    when char_length(q.prompt) >= 95 or char_length(coalesce(q.explanation, '')) >= 150 then 'dificil'
    else 'media'
  end as difficulty,
  md5(public._trivia_norm_prompt(q.prompt)),
  now()
from public.questions q
where q.active
on conflict (question_id) do nothing;
