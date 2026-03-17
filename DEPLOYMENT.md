# Deployment Notes

## Окружения

Для проекта обязательны два окружения:

- `preview` для превью-развертываний Vercel
- `production` для боевого окружения

Для каждого окружения должен использоваться отдельный Supabase-проект. Нельзя направлять `preview` и `production` в один и тот же Supabase instance, иначе тестовые пользователи, сообщения, Storage и Auth-ссылки смешаются.

## Привязка Vercel -> Supabase

Настройка должна быть такой:

| Окружение Vercel | `NEXT_PUBLIC_APP_URL` | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` |
| --- | --- | --- |
| `Preview` | Публичный URL preview-окружения | Значения только от preview Supabase-проекта |
| `Production` | Боевой публичный URL | Значения только от production Supabase-проекта |

`NEXT_PUBLIC_APP_URL` уже используется серверными auth-операциями для формирования ссылок подтверждения email:

- при регистрации `signUp(..., { emailRedirectTo: "${NEXT_PUBLIC_APP_URL}/login" })`
- при повторной отправке письма `resend(..., { options: { emailRedirectTo: "${NEXT_PUBLIC_APP_URL}/login" } })`

Это означает, что при корректно выставленном `NEXT_PUBLIC_APP_URL` письма подтверждения будут вести:

- в `preview` на preview-домен
- в `production` на production-домен

## Рекомендация по доменам

Для `production` должен быть один постоянный домен.

Для `preview` тоже нужен один стабильный публичный URL, если подтверждение email проверяется вручную в preview-среде. Не стоит полагаться на случайные одноразовые Vercel preview URL для auth-ссылок. Лучше использовать постоянный alias preview-окружения или выделенный preview-домен.

## Настройки Supabase Auth

В каждом Supabase-проекте нужно настроить Auth отдельно под свое окружение:

### Preview Supabase

- `Site URL`: preview-домен приложения
- `Redirect URLs`: как минимум `https://<preview-domain>/login`
- Email confirmations: включены

### Production Supabase

- `Site URL`: production-домен приложения
- `Redirect URLs`: как минимум `https://<production-domain>/login`
- Email confirmations: включены

Если используется несколько допустимых URL для окружения, их нужно добавить в `Redirect URLs` явно. Значение `Site URL` и `NEXT_PUBLIC_APP_URL` для окружения не должны расходиться.

## Настройка переменных в Vercel

В Vercel Project Settings -> Environment Variables должны быть заведены все четыре переменные:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Распределение по средам:

- `Preview`: только preview-значения
- `Production`: только production-значения

Смешивать ключи между окружениями нельзя.

## Чек-лист перед релизом

1. `Preview` в Vercel указывает на отдельный preview Supabase-проект.
2. `Production` в Vercel указывает на отдельный production Supabase-проект.
3. `NEXT_PUBLIC_APP_URL` совпадает с публичным URL соответствующего окружения.
4. В соответствующем Supabase Auth `Site URL` совпадает с `NEXT_PUBLIC_APP_URL`.
5. В `Redirect URLs` добавлен путь `.../login` для соответствующего окружения.
6. После регистрации и после resend письмо подтверждения ведет на домен нужного окружения.
