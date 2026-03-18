# План для AI-агента: ответы на сообщения в `/chat`

Источник требований: `.ai/chat-message-reply-spec.md`.

## Назначение документа

Этот план предназначен для AI-агента, который будет реализовывать feature reply-to-message в текущем коде. План опирается не только на спецификацию, но и на текущее состояние репозитория.

Цель агента:

- реализовать reply-сценарий без поломки уже существующих возможностей чата;
- сохранить текущие механики realtime / optimistic UI / пагинации / edit / delete;
- сделать поведение строго по спецификации, без самостоятельных продуктовых допущений.

## Текущее состояние кодовой базы

Ключевые точки входа:

- `src/app/chat/page.tsx` — SSR-загрузка initial messages и передача их в `ChatShell`.
- `src/components/chat/chat-shell.tsx` — shell чата, composer, unseen counter, delete/edit orchestration, optimistic send.
- `src/components/chat/live-message-list.tsx` — canonical client-side aggregation history + realtime + optimistic + delete tombstones + load older.
- `src/components/chat/message-list.tsx` — рендер bubble'ов, desktop/touch actions, группировка, avatar/name/time/status.
- `src/components/chat/message-composer.tsx` — compose/edit composer, image preview, textarea, submit.
- `src/lib/actions/messages.ts` — create / hydrate realtime / backfill / load older / edit / delete.
- `src/lib/messages/create-message.ts` — серверное создание сообщения.
- `src/lib/messages/list-messages.ts` — SSR/pagination data access.
- `src/lib/messages/render-message.ts` — преобразование server rows в `RenderedMessage`.
- `src/lib/messages/rendered-message.ts` — UI-модель сообщения.

Что уже есть и важно не сломать:

- Telegram-подобный layout уже реализован.
- Desktop actions и touch long-press уже реализованы, но только для управления сообщением; действия reply пока нет.
- Edit/Delete уже существуют.
- Realtime уже обрабатывает `INSERT`, `UPDATE`, `DELETE`.
- Пагинация older messages без прыжка уже существует.
- Optimistic-сообщения уже формируются в `ChatShell`.
- В БД уже есть `updated_at`, а также RLS для `UPDATE`/`DELETE`; повторно это не проектировать.

Что отсутствует:

- поля reply в БД;
- `replyTo` в UI-модели;
- reply panel над composer;
- reply block внутри bubble;
- переход по цитате к исходному сообщению;
- серверная нормализация reply snapshot;
- обновление already-loaded replies после удаления исходного сообщения.

## Инварианты реализации

- Не менять существующую базовую механику отправки, кроме расширения payload данными ответа.
- Не убирать optimistic UI.
- Не вводить отдельный thread mode.
- Не делать reply для optimistic-сообщений без постоянного `id`.
- Не менять snapshot reply после отправки, даже если исходное сообщение позже редактируется.
- При удалении исходного сообщения reply preview должен остаться, а переход стать недоступным.
- Если во время реализации обнаружится несоответствие между спецификацией и текущими серверными ограничениями, остановиться и спросить пользователя.

---

## Трекер задач

Легенда:

- `[ ]` не начато
- `[..]` в работе
- `[x]` завершено
- `[!]` блокер, нужно уточнение пользователя

### A. Модель данных и миграция

- [x] **A1**: Добавить reply-поля в таблицу `messages`.
- [x] **A2**: Настроить self-reference `reply_to_message_id -> messages.id` с `ON DELETE SET NULL`.
- [x] **A3**: Обновить комментарии/ограничения схемы так, чтобы snapshot-поля reply не терялись при удалении исходного сообщения.

### B. Типы и серверный контракт

- [x] **B1**: Добавить `replyTo` в `RenderedMessage`.
- [x] **B2**: Добавить reply-поля в server row mapping и pagination queries.
- [x] **B3**: Вынести единые helper'ы для preview/snapshot reply.

### C. Создание сообщения-ответа

- [x] **C1**: Расширить `createMessageFormAction` приемом reply payload из composer.
- [x] **C2**: Расширить `createMessage()` серверной нормализацией reply.
- [x] **C3**: Гарантировать, что optimistic-сообщение получает `replyTo` сразу при постановке в очередь.

### D. Realtime / SSR / pagination consistency

- [x] **D1**: SSR должен возвращать `replyTo`. (уже обеспечено: `page.tsx` → `renderMessagesForChat` с reply-полями из `listMessagesPage`; `render-message.ts` собирает `replyTo` через `buildReplyToFromRow`.)
- [x] **D2**: Realtime `INSERT` / `UPDATE` должны возвращать `replyTo`. (расширен `HydrateRealtimeMessageInput` и передача reply-полей в `renderMessageForChat`; в `live-message-list` тип `RealtimeMessageRow` и вызовы hydrate при INSERT/UPDATE передают reply из payload.)
- [x] **D3**: Older pages должны возвращать `replyTo` в том же формате. (уже обеспечено: `loadOlderMessagesPageAction` → `listMessagesPage` → `renderMessagesForChat` с reply-полями из items.)
- [x] **D4**: Проверить, что удаление исходного сообщения приводит к realtime-обновлению reply rows с `messageId = null`. (Код готов: при UPDATE приходит payload с `reply_to_message_id = null`, `buildReplyToFromRow` даёт `messageId: null`, `isNavigable: false`. Проверка вручную: удалить исходное сообщение в одном клиенте — в другом у ответа цитата остаётся, переход по ней недоступен; при необходимости убедиться, что таблица `messages` в Realtime publication и что приходят UPDATE-события.)

### E. Reply action в message actions

- [ ] **E1**: Добавить `Ответить` в desktop actions.
- [ ] **E2**: Добавить `Ответить` в touch context menu.
- [ ] **E3**: Разрешить reply и для own, и для foreign confirmed messages.
- [ ] **E4**: Запретить reply для optimistic/pending local messages.

### F. Reply state в shell/composer

- [ ] **F1**: Добавить shell-state активного ответа.
- [ ] **F2**: Сделать reply и edit взаимоисключающими.
- [ ] **F3**: Добавить reply panel над composer.
- [ ] **F4**: Сохранять compose text при входе/выходе из reply mode.
- [ ] **F5**: Сбрасывать reply panel после queueing сообщения и при ручной отмене.

### G. Reply block в bubble

- [ ] **G1**: Рендерить цитату внутри reply-сообщения.
- [ ] **G2**: Соблюсти порядок: quote -> image -> text -> time/status.
- [ ] **G3**: Соблюсти правила preview и цвета автора.
- [ ] **G4**: Сделать block кликабельным только когда `isNavigable = true`.

### H. Навигация к исходному сообщению

- [ ] **H1**: Реестр DOM-элементов сообщений по `message.id`.
- [ ] **H2**: Переход к already-loaded сообщению с центрированием.
- [ ] **H3**: Временная подсветка target bubble на `2000 ms`.
- [ ] **H4**: Автодогрузка older pages до нахождения reply target или исчерпания истории.
- [ ] **H5**: Игнор повторных кликов по той же цитате во время текущей догрузки.

### I. Стабилизация UX и a11y

- [ ] **I1**: `aria-label="Ответить на сообщение"` на desktop action button.
- [ ] **I2**: Текст `Ответить` в touch menu.
- [ ] **I3**: Корректный pointer/cursor state у navigable / non-navigable quote block.
- [ ] **I4**: Учет `prefers-reduced-motion` при scroll.

### J. Самопроверка по спецификации

- [ ] **J1**: Проверить acceptance criteria 1-15.
- [ ] **J2**: Проверить сценарий delete original -> reply survives -> no navigation.
- [ ] **J3**: Проверить сценарий edit original -> old reply snapshot unchanged.
- [ ] **J4**: Проверить text-only / image-only / text+image source messages.

---

## Предлагаемая структура реализации

### 1. Новые типы и helper'ы

Создать новые shared helper'ы вместо дублирования логики по файлам.

Рекомендуемые сущности:

- `src/lib/messages/reply-preview.ts`
- `src/lib/messages/message-reply.ts`

Что вынести:

- тип UI-ответа:
  - `messageId: string | null`
  - `senderId: string`
  - `senderName: string`
  - `previewText: string`
  - `hasImage: boolean`
  - `isNavigable: boolean`
- helper построения preview текста по единым правилам спеки;
- helper усечения preview до `80` символов;
- helper получения текста `Фото` / `Сообщение`;
- helper сборки reply snapshot из source message.

Важно:

- одна и та же логика preview должна использоваться:
  - в reply panel над composer;
  - при optimistic insert;
  - при server-side create;
  - при render reply block в bubble.

---

## Детальная декомпозиция по задачам

### A. Модель данных и миграция

Файлы:

- `supabase/migrations/*`

Нужно добавить новую миграцию для reply-полей:

- `reply_to_message_id uuid null`
- `reply_to_sender_id uuid null`
- `reply_to_sender_name text null`
- `reply_to_preview_text text null`
- `reply_to_has_image boolean null`

Рекомендуемое решение:

- `reply_to_message_id` сделать foreign key на `public.messages(id)` c `on delete set null`.

Почему именно так:

- это автоматически сохранит snapshot-поля ответа;
- при удалении исходного сообщения останется preview;
- сама ссылка занулится на уровне БД;
- при включенном realtime на `UPDATE` уже существующие reply rows должны доехать в UI как updated rows.

Проверить:

- nullable-поведение для всех reply-полей у обычных сообщений;
- отсутствие каскадного удаления reply-сообщений;
- миграция должна быть идемпотентной в стиле уже существующих SQL-файлов.

### B. Типизация и чтение данных

Файлы:

- `src/lib/messages/rendered-message.ts`
- `src/lib/messages/list-messages.ts`
- `src/lib/messages/render-message.ts`
- `src/lib/actions/messages.ts`
- `src/app/chat/page.tsx`

Нужно:

1. Добавить вложенный тип `MessageReplyTo` в `rendered-message.ts`.
2. Расширить `RenderedMessage` полем `replyTo: MessageReplyTo | null`.
3. В `list-messages.ts` добавить reply-поля в:
   - `MessageRow`
   - `MessageListItem`
   - select-запросы
   - `mapMessageRow`
4. В `render-message.ts` прокинуть reply-поля в итоговый `RenderedMessage`.
5. В `page.tsx`, `loadOlderMessagesPageAction`, `backfillMessagesAfterCursorAction`, `hydrateRealtimeMessageAction` передавать reply-данные без расхождений.

Важно:

- агент не должен создавать несколько разных форматов `replyTo`;
- SSR, pagination, realtime hydrate и direct create должны возвращать идентичную форму данных.

### C. Серверная нормализация reply при создании сообщения

Файлы:

- `src/lib/actions/messages.ts`
- `src/lib/messages/create-message.ts`

Нужно расширить форму отправки из composer данными reply.

Предлагаемый контракт form-data:

- `replyToMessageId`
- `replyToSenderId`
- `replyToSenderName`
- `replyToPreviewText`
- `replyToHasImage`

На сервере:

1. Прочитать reply payload из `createMessageFormAction`.
2. Передать его в `createMessage()`.
3. В `createMessage()`:
   - если `replyToMessageId` передан, попытаться прочитать исходное сообщение из БД;
   - если найдено, сохранить:
     - `reply_to_message_id = source.id`
     - `reply_to_sender_id = source.sender_id`
     - `reply_to_sender_name = source.sender_display_name || source.sender_email`
     - `reply_to_preview_text = server-built snapshot`
     - `reply_to_has_image = source.image_path != null`
   - если не найдено, создать сообщение без ссылки:
     - `reply_to_message_id = null`
     - snapshot-поля взять из client payload
4. После insert вернуть уже нормализованный `RenderedMessage` с `replyTo`.

Критично:

- snapshot preview должен строиться по server rules, если source message существует;
- snapshot не должен зависеть от клиентского цвета;
- `isNavigable` вычислять из факта наличия `reply_to_message_id`.

### D. Optimistic UI для reply

Файлы:

- `src/components/chat/chat-shell.tsx`

Нужно:

1. Ввести локальный тип reply draft для composer.
2. При нажатии `Ответить` собирать snapshot из выбранного `RenderedMessage`.
3. При optimistic insert добавлять в локальный `RenderedMessage.replyTo` snapshot немедленно.
4. После постановки сообщения в очередь сразу сбрасывать active reply draft.
5. Если запрос завершился ошибкой, failed optimistic message должен остаться с reply block.

Рекомендуемый shell-state:

- `activeReplyDraft: { messageId, senderId, senderName, previewText, hasImage, isNavigable } | null`

Важно:

- compose text не должен теряться при выборе reply;
- при выборе нового source message старый draft должен просто заменяться;
- при старте edit reply draft надо сбрасывать без подтверждения.

### E. Actions в `MessageList`

Файлы:

- `src/components/chat/message-list.tsx`

Нужно переработать action-меню так, чтобы:

- у own confirmed message было: `Ответить`, `Редактировать`, `Удалить`;
- у foreign confirmed message было: `Ответить`;
- у optimistic/pending local message не было reply action;
- desktop block и touch menu работали одинаково по составу действий.

Изменения по месту:

1. В props `MessageList` добавить:
   - `onReplyMessage?: (message: RenderedMessage) => void`
   - `onNavigateToReply?: (replyToMessageId: string) => void`
   - `highlightedMessageId?: string | null`
   - `registerMessageElement?: (messageId: string, node: HTMLElement | null) => void`
2. Пересчитать `canReplyMessage` отдельно от `canManageMessage`.
3. Не ограничивать reply только outgoing bubble'ами.
4. Добавить кнопку reply в desktop actions первым пунктом.
5. Добавить `Ответить` первым пунктом в touch menu.

Условия доступности:

- reply доступен только если `message.id` не локальный placeholder;
- reply недоступен для optimistic message без server id;
- edit/delete как и раньше только для own message.

### F. Reply panel в `MessageComposer`

Файлы:

- `src/components/chat/message-composer.tsx`

Нужно добавить новый compose-only UI-блок над текущей строкой ввода.

Новые props, которые стоит добавить:

- `replyDraft?: MessageReplyTo | null`
- `onCancelReply?: () => void`

Панель должна содержать:

- цветную vertical bar `3px`;
- строку `В ответ {senderName}`;
- preview source message;
- кнопку закрытия.

Поведение:

- при закрытии панели текст textarea не очищается;
- панель не показывается в режиме edit;
- если agent включает edit mode, reply state должен быть уже очищен на уровне `ChatShell`.

Важно:

- цвет автора брать тем же hash-алгоритмом, что уже используется в `message-list.tsx`;
- лучше вынести color helper в отдельный shared util, чтобы не дублировать функцию.

### G. Рендер reply block внутри bubble

Файлы:

- `src/components/chat/message-list.tsx`

Нужно вставить reply block в bubble перед изображением/текстом.

Структура внутри bubble:

1. quote block
2. image текущего сообщения
3. text текущего сообщения
4. meta row

UI-правила:

- vertical bar `3px`
- lightened background относительно bubble
- radius `10px`
- padding `8px`
- margin-bottom `6px`
- строка 1 = `replyTo.senderName`
- строка 2 = `replyTo.previewText`

Интерактивность:

- весь quote block кликабелен только при `replyTo.isNavigable === true` и `replyTo.messageId !== null`;
- иначе это статичное preview без pointer cursor.

Рекомендация:

- вынести JSX рендера quote block в локальный helper/component внутри `message-list.tsx`, чтобы не перегрузить основной map.

### H. Навигация к исходному сообщению

Основная orchestration логичнее всего в:

- `src/components/chat/live-message-list.tsx`

Почему:

- там уже живут `messages`, `hasMore`, `cursor`, `load older`;
- там проще организовать цикл "загрузить еще страницу и снова проверить наличие target".

Нужно добавить:

- `highlightedMessageId` state;
- `navigatingReplyTargetId` state/ref;
- `messageElementByIdRef = new Map<string, HTMLElement>()`.

Алгоритм `navigateToMessage(targetId)`:

1. Если target уже есть в DOM:
   - найти его element;
   - выполнить scroll с центрированием;
   - после scroll включить highlight на `2000 ms`.
2. Если target нет в DOM:
   - пока `hasMore === true`:
     - если уже идет navigation к этому же `targetId`, игнорировать повторный клик;
     - вызвать `loadOlderMessagesPageAction`;
     - дождаться обновления layout;
     - проверить DOM снова;
   - если найдено:
     - scroll to center;
     - highlight;
   - если история закончилась:
     - ничего не делать, просто оставить quote static.

Правила scroll:

- если `prefers-reduced-motion: reduce`, использовать `behavior: "auto"`;
- иначе `behavior: "smooth"`;
- центрировать внутри scroll container, а не относительно окна.

Практическая реализация центрирования:

- взять `containerRect` и `targetRect`;
- вычислить `desiredScrollTop = currentScrollTop + (targetCenter - containerCenter)`;
- применить `scrollTo({ top: desiredScrollTop, behavior })`.

Подсветка:

- применяется только к bubble;
- повторный клик по той же цитате должен перезапустить таймер.

### I. Обновление already-loaded replies после delete original

Файлы:

- БД миграция
- `src/components/chat/live-message-list.tsx`
- `src/lib/actions/messages.ts`

Ожидаемая модель:

- удаление original message удаляет только original row;
- reply rows получают `reply_to_message_id = null` из-за `ON DELETE SET NULL`;
- Supabase realtime шлет `UPDATE` для reply rows;
- `hydrateRealtimeMessageAction` возвращает уже ненавигируемые `replyTo`.

Что проверить отдельно:

- текущая realtime publication действительно публикует `UPDATE` после FK-trigger update;
- если нет, это блокер, и агент должен остановиться и спросить пользователя перед внедрением workaround.

### J. Взаимодействие reply и edit

Файлы:

- `src/components/chat/chat-shell.tsx`
- `src/components/chat/message-composer.tsx`
- `src/components/chat/message-list.tsx`

Точные правила реализации:

1. `handleRequestReply(message)`:
   - `setEditDraft(null)`
   - `setActiveReplyDraft(newDraft)`
2. `handleRequestEdit(...)`:
   - `setActiveReplyDraft(null)`
   - `setEditDraft(...)`
3. Если пользователь уже reply'ит и выбирает другое сообщение:
   - просто заменить `activeReplyDraft`
4. При successful queueing compose-message:
   - очистить только reply draft
   - не трогать optimistic reply block

Не делать:

- не переносить edit text в compose reply mode;
- не спрашивать подтверждение при переключении между reply/edit;
- не очищать compose textarea при cancel reply.

### K. Изменения в `page.tsx` и SSR

Файлы:

- `src/app/chat/page.tsx`

Нужно:

- прокинуть reply-поля в `renderMessagesForChat(...)` на initial SSR;
- не менять схему работы с `historyPages`, если это не требуется для reply;
- не делать лишний refactor page-level loading.

### L. Самопроверка и последовательность выполнения

Рекомендуемый порядок работы агента:

1. Сначала `A + B + shared helpers`.
2. Потом `C + D`, чтобы данные начали ходить end-to-end.
3. Потом `E + F + G`, чтобы UI смог выбирать и отображать reply.
4. Потом `H + I + J`, чтобы заработала навигация и delete-origin edge case.
5. Потом `L/J` — полная самопроверка по acceptance criteria.

Причина такого порядка:

- UI без server-contract быстро уйдет в рассинхрон;
- navigation бессмысленно делать раньше, чем появится reply block;
- delete-origin edge case лучше проверять после end-to-end wiring.

---

## Минимальный список конкретных правок по файлам

### Обязательно изменить

- `src/lib/messages/rendered-message.ts`
- `src/lib/messages/list-messages.ts`
- `src/lib/messages/render-message.ts`
- `src/lib/messages/create-message.ts`
- `src/lib/actions/messages.ts`
- `src/components/chat/chat-shell.tsx`
- `src/components/chat/live-message-list.tsx`
- `src/components/chat/message-list.tsx`
- `src/components/chat/message-composer.tsx`
- `src/app/chat/page.tsx`
- `supabase/migrations/<new_reply_migration>.sql`

### Вероятно добавить

- `src/lib/messages/reply-preview.ts`
- `src/lib/messages/message-reply.ts`
- при необходимости небольшой UI-helper для reply panel / quote block, если `message-list.tsx` станет слишком громоздким

---

## Acceptance checklist для агента

Перед завершением агент обязан проверить следующее:

- У любого confirmed message доступно `Ответить`.
- У own confirmed message порядок действий: `Ответить`, `Редактировать`, `Удалить`.
- У foreign confirmed message доступно только `Ответить`.
- Reply panel над composer показывает `В ответ {senderName}` и preview.
- Cancel reply не очищает textarea.
- После отправки optimistic message уже содержит reply quote block.
- Confirmed message после ответа содержит quote block над image/text.
- Preview text в composer и bubble строится по одним правилам.
- Клик по quote block центрирует target message.
- Target bubble подсвечивается на `2000 ms`.
- Если target не был загружен, older pages догружаются автоматически.
- Если target удален, reply preview остается, но navigation не выполняется.
- Изменение original message не меняет snapshot уже отправленных reply messages.
- SSR / realtime / pagination отдают один и тот же shape `replyTo`.

---

## Stop conditions

Агент должен остановиться и спросить пользователя, если:

- выяснится, что текущая схема БД не позволяет безопасно добавить self-FK на `messages.id`;
- realtime не публикует нужные `UPDATE` после `ON DELETE SET NULL`, и для соблюдения спеки нужен новый серверный workaround;
- в проекте найдется скрытая уже начатая reply-реализация, конфликтующая с этим планом;
- спецификация и фактические ограничения Supabase/Next заставляют выбирать один из двух несовместимых вариантов поведения.
