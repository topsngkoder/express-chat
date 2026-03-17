# План для AI‑агента: Telegram‑подобный UI страницы `/chat`

Источник требований: `.ai/telegram-chat-ui-spec.md`.

## Контекст текущей кодовой базы (что уже есть)

- **Страница**: `web/src/app/chat/page.tsx` (Server Component, сейчас “карточный” UI, нет фиксированных зон, догрузка истории через query `historyPages` и переход по ссылке).
- **Realtime (только INSERT)**: `web/src/components/chat/live-message-list.tsx` подписка на Supabase `postgres_changes` и гидратация через `hydrateRealtimeMessageAction`.
- **Список сообщений (не телеграм)**: `web/src/components/chat/message-list.tsx`.
- **Композер (не телеграм)**: `web/src/components/chat/message-composer.tsx`.
- **Server actions**: `web/src/lib/actions/messages.ts` (create, hydrate realtime, backfill after reconnect).
- **Messages data access**: `web/src/lib/messages/list-messages.ts`, `web/src/lib/messages/create-message.ts`, `web/src/lib/messages/render-message.ts`.
- **Профили/аватары**: `web/src/lib/profile/profile-service.ts` (есть `getAvatarSignedUrl`, TTL 1 час).
- **DB**:
  - `supabase/migrations/20260317121000_create_messages.sql` (нет `updated_at` у сообщений).
  - `supabase/migrations/20260317123000_messages_rls.sql` (RLS есть только для SELECT/INSERT, нет UPDATE/DELETE).
  - `supabase/migrations/20260317132000_messages_realtime.sql` (таблица добавлена в publication; в UI сейчас слушается только INSERT).

## Инварианты из спецификации (не ломать)

- Текущие правила валидации/лимитов/загрузки изображений/доставки новых сообщений сохраняются, **кроме** расширения realtime на UPDATE/DELETE и добавления edit/delete.

## Цели по спецификации (коротко)

- `/chat` = **единый экран**: фиксированный Header (56px) + фиксированный Composer (min 56 / max 160) + единственная прокручиваемая зона сообщений.
- Telegram‑подобные пузырьки: incoming слева с аватаром, outgoing справа без аватара, “хвостики”, группировка в пределах 5 минут.
- Скролл‑UX: автоскролл на INSERT только если “у низа” (≤120px), иначе кнопка “↓ Новые сообщения” со счётчиком.
- “Показать более ранние сообщения” сверху списка без “прыжка” позиции.
- Edit/Delete **только** для собственных: hover‑иконки (desktop), long‑press (touch), подтверждение удаления, режим редактирования в Composer.
- Данные: для UI нужны `senderId`, `senderName`, `senderAvatarUrl`, `updatedAt`.

---

## Трекер задач (выполнять сверху вниз)

Легенда статусов:
- `[ ]` не начато
- `[..]` в работе
- `[x]` готово
- `[!]` блокер (нужен ответ пользователя)

### A. Архитектура UI `/chat`

- [x] **A1**: Перестроить `/chat` под единый экран (Header / ScrollArea / Composer).
- [x] **A2**: Вынести client‑shell компонент чата (единое состояние: messages, cursor, scroll, editMode, modals).
- [x] **A3**: Убрать/перенести “внешние” секции, которые ломают модель “единый экран” (например `ChatFeedbackSections`).

### B. Данные/типизация сообщений для UI

- [x] **B1**: Расширить тип `RenderedMessage` полями `updatedAt` и `senderAvatarUrl`.
- [x] **B2**: Обеспечить получение `senderAvatarUrl` (nullable) для каждого сообщения.
- [x] **B3**: Обеспечить наличие `updatedAt` (nullable) и корректную логику метки `изменено`.

### C. Realtime: INSERT/UPDATE/DELETE

- [x] **C1**: Расширить подписку в `LiveMessageList` на `UPDATE` и `DELETE`.
- [x] **C2**: Обновление сообщения на UPDATE без автоскролла, без “прыжка” позиции.
- [x] **C3**: Удаление сообщения на DELETE без автоскролла, без “прыжка” позиции.
  - Примечание: в приложении пока нет UI/действия удаления, поэтому проверить можно либо вручную через SQL `delete from public.messages where id = '...'`, либо после задач **H4/G3**.

### D. Скролл‑UX (низ/кнопка новых/догрузка вверх)

- [x] **D1**: Автоскролл в самый низ при первом монтировании (после начальной загрузки).
- [x] **D2**: Детектор “у низа” (≤120px) + логика кнопки “↓ Новые сообщения” со счётчиком.
- [x] **D3**: Догрузка ранних сообщений по кнопке сверху **без прыжка** (prepend + сохранение anchor).
  - Реализация: `loadOlderMessagesPageAction` + кнопка в `MessageList` → prepend в `LiveMessageList` с восстановлением `scrollTop` по разнице `scrollHeight`.
- [x] **D4**: Нижний padding у зоны сообщений = фактической высоте Composer (динамически).
  - Реализация: `ResizeObserver` в `ChatShell` выставляет `padding-bottom` scroll‑контейнера по высоте фактического перекрытия композером (если будет overlay).

### E. Telegram‑рендер сообщений

- [x] **E1**: Алгоритм группировки по `senderId` и разнице времени ≤ 5 минут.
- [x] **E2**: Пузырьки incoming/outgoing, max‑width 78% / 62%, внутренние отступы, радиусы, “хвостик”.
- [x] **E3**: Аватар 32×32 для incoming только у первого в группе + “резерв места” для остальных.
- [x] **E4**: Имя отправителя (только incoming, только первое в группе) + детерминированный цвет по `senderId` из палитры.
- [x] **E5**: Время `HH:MM` (ru‑RU) внутри пузырька справа снизу + `✓✓` для outgoing всегда + `изменено` при `updatedAt != null`.
- [x] **E6**: Изображение в пузырьке: width=100%, max‑height 320/420, contain, radius 12; если только изображение — padding пузырька 4px.

### F. Composer Telegram‑стиля

- [x] **F1**: Новый layout Composer: скрепка слева, авто‑textarea по центру, самолётик справа.
- [x] **F2**: Авто‑рост textarea до 5 строк, дальше внутренний скролл; Enter отправка, Shift+Enter новая строка.
- [x] **F3**: Панель предпросмотра изображения (40×40, имя, размер, крестик) над строкой ввода.
- [x] **F4**: Pending‑состояние: блокировать всё, не допускать повторной отправки.
- [x] **F5**: Режим редактирования (UI/горячие клавиши/валидация/кнопки “Отмена/Сохранить”).

### G. Действия с сообщениями (edit/delete)

- [ ] **G1**: Hover‑иконки (desktop) для outgoing: карандаш + крестик, 16×16, hit‑area 32×32, видимость на hover/focus.
- [ ] **G2**: Long‑press (touch) 450ms: контекстное меню “Редактировать/Удалить”, закрытие по клику вне.
- [ ] **G3**: Confirm‑modal удаления (текст/кнопки/деструктивность) + обработка ошибок.
- [ ] **G4**: Интеграция с Composer: вход в editMode, подстановка текста, выход, Esc=cancel.

### H. Серверная логика edit/delete + DB/RLS

- [ ] **H1**: Миграция БД: добавить `updated_at` (nullable) в `messages` и логику его заполнения только при edit.
- [ ] **H2**: RLS политики для `UPDATE` и `DELETE` только для собственных сообщений.
- [ ] **H3**: Server action “edit message”: менять только `text`, валидировать “не пусто без изображения”, выставлять `updated_at=now()`.
- [ ] **H4**: Server action “delete message”: удалить запись; best‑effort удалить файл изображения из storage.
- [ ] **H5**: Обновить server‑рендер/гидратацию, чтобы `senderAvatarUrl` и `updatedAt` попадали в UI (SSR и realtime).

### I. Доступность (a11y) и клавиатура

- [ ] **I1**: Все интерактивные элементы достижимы Tab’ом, видимый focus.
- [ ] **I2**: `aria-label` на иконках (настройки/скрепка/отправка/редакт/удал/закрыть превью/новые сообщения).
- [ ] **I3**: Сообщение как фокусируемый элемент + focus‑within для показа иконок.

### J. Приёмка / самопроверка

- [ ] **J1**: Прогон критериев приемки 1–14 из спецификации.
- [ ] **J2**: Ручные сценарии: автоскролл/кнопка новых/догрузка вверх/режим редактирования/удаление/ошибки.
- [ ] **J3**: Проверка адаптива 320px и desktop max‑width 960px.

---

## Технические заметки (сборка/деплой)

- [x] **Build fix**: `web/next.config.ts` — перенесено `serverActions.bodySizeLimit` в `experimental.serverActions.bodySizeLimit`, чтобы `next build` на Vercel не падал по типам.
- [x] **Build fix**: `web/src/app/settings/page.tsx` — убран импорт `isRedirectError` из `next/navigation` (нет в текущих типах Next); добавлена локальная проверка redirect‑ошибки через `error.digest.startsWith("NEXT_REDIRECT")`.

---

## Детальная декомпозиция по реализации (что именно делать)

### A. Архитектура UI `/chat`

**A1. Единый экран**
- В `web/src/app/chat/page.tsx` заменить текущую верстку (карточки/секции) на контейнер `h-dvh`/`overflow-hidden`.
- Внутри:
  - `ChatHeader` (sticky/fixed top, 56px, фон/бордер из токенов).
  - `ChatScrollArea` (единственный scroll container, `overflow-y-auto`, занимает пространство между header/composer).
  - `ChatComposer` (sticky/fixed bottom, min/max height, border top).
- Цвета задать **фиксированно** (без зависимости от `dark:`), используя точные hex.

**A2. Client shell**
- Создать `web/src/components/chat/chat-shell.tsx` (или переиспользовать `LiveMessageList`, но расширить до “shell”):
  - состояние: `messages`, `cursor`, `hasMore`, `loadingMore`, `unseenCount`, `isAtBottom`, `editDraft`, `modalState`.
  - refs: `scrollRef`, `composerRef`, `latestInsertRef`.
  - эффекты: initial scroll, resize observer для composer height → padding‑bottom scroll area.

**A3. Удалить “внешние” секции**
- `ChatFeedbackSections` сейчас встраивает composer как отдельную карточку. Для спеки `/chat` это лишнее.
- Решение: composer и feedback/toast встроить внутрь “единый экран”.

### B. Данные/типизация

**B1. Расширение `RenderedMessage`**
- В `web/src/lib/messages/rendered-message.ts` добавить:
  - `updatedAt: string | null`
  - `senderAvatarUrl: string | null`
- Актуализировать `compareRenderedMessages`/`mergeRenderedMessages` (merge по id ок, но нужно корректно обновлять поля).

**B2. `senderAvatarUrl`**
Вариант, наиболее совместимый с текущей схемой Supabase:
- Добавить FK `messages.sender_id -> profiles.id`, чтобы PostgREST позволил relation‑select (или иной согласованный способ получить `avatar_path` пачкой).
- Реализация на сервере:
  - Получать `avatar_path` для `senderId` из `profiles`.
  - Подписывать через `getAvatarSignedUrl(avatarPath)` из `profile-service.ts`.
  - Желательно батчить по уникальным senderId (чтобы не делать N запросов на 50 сообщений).

**B3. `updatedAt`**
- Добавить DB‑колонку `updated_at timestamptz null` в `messages`.
- В `render-message.ts` прокинуть `updatedAt` в результат.

### C. Realtime UPDATE/DELETE

**C1. Подписка**
- В `web/src/components/chat/live-message-list.tsx`:
  - добавить `.on(... event: "UPDATE" ...)` и `.on(... event: "DELETE" ...)`.
  - расширить тип `RealtimeMessageRow` полями `updated_at` (nullable) + убедиться, что payload содержит нужные поля.

**C2. UPDATE**
- На UPDATE обновлять message в local state:
  - либо “легко”: вызвать новую server action `hydrateRealtimeMessageAction` (или отдельную `hydrateRealtimeMessageUpdateAction`) и merge по id;
  - либо “быстро”: обновить `text`/`updatedAt` локально и при необходимости пересчитать `image.alt`.
- Не запускать автоскролл (см. D2).

**C3. DELETE**
- На DELETE удалить сообщение по id из state.
- Скролл не дёргать.

### D. Скролл‑UX

**D1. Initial scroll**
- После первого рендера списка (и после подгрузки initialMessages) выполнить `scrollToBottom()`.

**D2. “У низа” + кнопка новых**
- На scroll событиях вычислять:
  - `distanceToBottom = scrollHeight - (scrollTop + clientHeight)`
  - `isAtBottom = distanceToBottom <= 120`
- При INSERT:
  - если `isAtBottom` → `scrollToBottom()`
  - иначе увеличить `unseenCount` и показать кнопку `↓ Новые сообщения` (с текстом `↓ N новых`).
- При клике по кнопке → `scrollToBottom()` + `unseenCount=0`.
- При достижении низа скроллом пользователя → `unseenCount=0`.

**D3. Догрузка вверх без прыжка**
- Избавиться от `Link` + `historyPages`. Вместо этого:
  - иметь `cursor` (`MessageListCursor`) на клиенте;
  - по нажатию “Показать более ранние сообщения” вызвать server action, которая возвращает следующую страницу *старых* сообщений и новый `cursor`.
- Для “без прыжка”:
  - до prepend сохранить `prevScrollHeight` и `prevScrollTop`;
  - после prepend дождаться layout (requestAnimationFrame) и выставить `scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight)`.

**D4. Padding снизу под Composer**
- `ResizeObserver` на Composer → выставлять `scrollArea.style.paddingBottom = composerHeight + "px"`.

### E. Telegram‑рендер

**E1. Группировка**
- На уровне рендера построить массив “view models”:
  - `isOutgoing = senderId === currentUserId`
  - `isGroupStart` (предыдущее сообщение другой senderId или разница > 5 минут)
  - `isGroupedWithPrev` для определения вертикальных отступов (4px внутри группы, 12px между группами).

**E2. Bubble + tail**
- Реализовать `MessageBubble` с:
  - входящим/исходящим фоном (`#182533` / `#2B5278`)
  - padding 8/10, radius 16
  - хвостик (лучше через pseudo‑element в CSS module или tailwind `before:`), вынос 6px снизу слева/справа.

**E3. Avatar**
- Для incoming:
  - если `isGroupStart`: показать `Avatar32` (из `senderAvatarUrl` или fallback initials)
  - иначе: пустой spacer шириной 32px (плюс gap), чтобы выровнять пузырьки.
- Для outgoing: ни avatar, ни spacer.

**E4. Sender name + color**
- Показывать только для incoming и только при `isGroupStart`.
- Цвет выбрать детерминированно по `senderId` из палитры:
  - `#F07474`, `#F4A261`, `#E9C46A`, `#2A9D8F`, `#3A86FF`, `#8338EC`, `#FF006E`, `#4CC9F0`
- Детерминизм: простая hash‑функция строки → индекс массива.

**E5. Time/status/edited**
- Time formatter: `Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" })`.
- В outgoing: отображать `HH:MM` + (если `updatedAt`) `изменено` + `✓✓` всегда.
- В incoming: только `HH:MM`.
- Цвета времени: incoming `#8FA1B3`, outgoing `#B7C9DA`.

**E6. Images**
- В bubble сверху `<img>`:
  - `object-contain`, width 100%
  - max-height 320 (<640) / 420 (≥640)
  - radius 12
- Если text отсутствует → уменьшить padding bubble до 4px (но bubble сохранять).

### F. Composer

**F1–F3. UI**
- Переписать `web/src/components/chat/message-composer.tsx` под Telegram‑layout:
  - слева кнопка‑иконка (скрепка) → открывает hidden `<input type=file accept=...>`
  - центр: textarea (auto-grow) placeholder `Сообщение...`
  - справа: кнопка‑иконка (самолётик), активна только если trim(text) или есть image
  - preview panel над строкой: thumbnail 40×40 + name/size + X

**F2. Enter/Shift+Enter**
- Обработка onKeyDown:
  - `Enter` без Shift → preventDefault, submit
  - `Shift+Enter` → newline

**F5. Edit mode**
- Добавить пропсы/контракт:
  - `mode: "compose" | "edit"`
  - `editingMessageId?: string`
  - `initialText?: string | null`
  - callbacks: `onSaveEdit`, `onCancelEdit`
- В edit mode:
  - скрыть скрепку
  - заменить “самолётик” на кнопку `Сохранить` (text)
  - сверху status bar: `Редактирование сообщения` + кнопки `Отмена` и `Сохранить`
  - `Esc` → cancel
  - если save: trim, если пусто и у сообщения нет изображения → показать `Сообщение не может быть пустым`
  - если текст после trim не изменился → не делать запрос, просто выйти

### G. UI‑действия для сообщений

**G1. Desktop hover**
- В outgoing bubble:
  - контейнер `relative`
  - кнопки иконок positioned top-right
  - скрыты по умолчанию, видимы при `group-hover` и `focus-within`
  - `aria-label="Редактировать сообщение"`, `aria-label="Удалить сообщение"`

**G2. Mobile long‑press**
- На bubble:
  - поставить таймер 450ms на `pointerdown`, сбрасывать на `pointerup/move/cancel`
  - при срабатывании открыть маленькое меню (позиционирование рядом с bubble, можно через `getBoundingClientRect`)
  - клик вне меню закрывает

**G3. Confirm modal**
- Реализовать простой `ConfirmDialog` (portal не обязателен, но нужно `role="dialog"`, `aria-modal="true"`, trap‑focus желательно).
- Тексты строго по спеки:
  - title: `Удалить сообщение?`
  - body: `Сообщение будет удалено у всех участников. Отменить действие нельзя.`
  - buttons: `Отмена`, `Удалить` (деструктивная)
- Ошибка: `Не удалось удалить сообщение. Попробуйте позже`

### H. Сервер и DB

**H1. Миграции**
- Добавить новую миграцию в `supabase/migrations/`:
  - `alter table public.messages add column if not exists updated_at timestamptz null;`
  - (опционально) добавить FK `sender_id` → `profiles.id` (если выбран путь relation‑select).
- Важно: `updated_at` не должен заполняться на INSERT.

**H2. RLS**
- Новая миграция расширяет `messages_rls`:
  - UPDATE разрешён только если `sender_id = auth.uid()` и confirmed
  - DELETE разрешён только если `sender_id = auth.uid()` и confirmed

**H3. Edit server action**
- Добавить в `web/src/lib/actions/messages.ts`:
  - `editMessageAction({ messageId, text })`
  - внутри: require user, select message (id, sender_id, image_*), проверить ownership
  - собрать `image` метаданные из row если image_path != null и передать в `parseMessageDraft({ text, image })`
  - если текст не изменился (после trim строгое сравнение) → вернуть “no-op success”
  - update messages set text = draft.text, updated_at = now() where id=... and sender_id=auth.uid()
  - `revalidatePath("/chat")` для SSR совместимости (хотя realtime обновит ленту)

**H4. Delete server action**
- `deleteMessageAction({ messageId })`:
  - select message (id, sender_id, image_path) + ownership
  - delete row
  - если был `image_path` → best‑effort `admin.storage.from("chat-images").remove([path])`
  - ошибка → public message из спеки

**H5. `senderAvatarUrl`**
- Добавить server‑side функцию получения avatar_path по senderId:
  - батч: `select id, avatar_path from profiles where id in (...)`
  - для каждого пути вызвать `getAvatarSignedUrl`
- Прокинуть в:
  - SSR: `ChatPage` → `renderMessagesForChat` (нужно расширить input/выход)
  - realtime hydrate: `hydrateRealtimeMessageAction` → возвращать `senderAvatarUrl`

### I. Доступность

- Все иконки: `aria-label`.
- Сообщение: `tabIndex=0`, `role="article"` или `role="group"` + `aria-label` с sender/time (минимально).
- Видимый focus: outline/box-shadow.
- Для меню long‑press: `role="menu"`, пункты `role="menuitem"`.

### J. Приёмка

Сверить реализованное с пунктами 1–14 из “Критерии приемки” спеки. Минимальный ручной чек:
- фиксация Header/Composer и scroll только в зоне сообщений
- цвета/размеры токенов
- группировка 5 минут + имя/аватар только на старте группы
- автоскролл и кнопка новых
- edit/delete desktop+mobile + modal confirm
- realtime UPDATE/DELETE на втором клиенте (две вкладки)

