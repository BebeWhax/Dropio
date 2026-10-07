import type { Locale } from "@/i18n/config";

/**
 * DRAFT policy texts. They are starting points, not legal advice: have them
 * reviewed before launch. {company}, {email}, {address}, {taxId} come from
 * LEGAL_* environment variables.
 */

export type LegalPage = "terms" | "privacy" | "refunds" | "contacts";

export interface LegalDoc {
  title: string;
  sections: { heading: string; body: string[] }[];
}

export const LEGAL_UPDATED = "2026-10-07";

export const legalDocs: Record<Locale, Record<LegalPage, LegalDoc>> = {
  en: {
    terms: {
      title: "Terms of Service",
      sections: [
        {
          heading: "1. The service",
          body: [
            "Dropio (“we”, “the service”) is operated by {company}. It helps sellers research products by comparing supplier costs with marketplace prices and estimating shipping, import charges, taxes and fees.",
            "All prices, margins, duty and fee figures are estimates based on third-party data and published rules. They are not financial, tax or legal advice, and we do not guarantee their accuracy or any sales result.",
          ],
        },
        {
          heading: "2. Accounts",
          body: [
            "You must provide a valid email address and keep your password confidential. You are responsible for activity under your account.",
            "You must be at least 18 years old or the age of majority in your country to subscribe to a paid plan.",
          ],
        },
        {
          heading: "3. Plans and payment",
          body: [
            "Paid plans are monthly subscriptions that renew automatically until cancelled. Prices are shown on the Plan & billing page in USD (card payments via Stripe) or UAH (LiqPay, monobank).",
            "Payments are processed by our payment providers; we do not store your full card details. Plan limits (daily analyses, searches, countries) are described on the pricing page.",
          ],
        },
        {
          heading: "4. Cancellation",
          body: [
            "You can cancel at any time on the Plan & billing page. Your plan stays active until the end of the period you have paid for and is not renewed afterwards. See the Refund Policy for refunds.",
          ],
        },
        {
          heading: "5. Acceptable use",
          body: [
            "Do not misuse the service: no attempts to break security, resell access, overload our systems, scrape the service automatically, or upload content you have no right to use.",
            "We may suspend accounts that breach these terms.",
          ],
        },
        {
          heading: "6. Your content",
          body: [
            "Files and images you upload (CSV lists, product photos) remain yours. You allow us to process them, and to send them to the data providers needed to answer your request (for example image search services), only to provide the service.",
          ],
        },
        {
          heading: "7. Liability",
          body: [
            "The service is provided “as is”. To the extent permitted by law, our total liability is limited to the amount you paid us in the 3 months before the claim. We are not liable for lost profits or business decisions made using the estimates.",
          ],
        },
        {
          heading: "8. Changes and governing law",
          body: [
            "We may update these terms; we will notify you of material changes by email or in the app. These terms are governed by the laws of Ukraine, without prejudice to mandatory consumer protections in your country.",
            "Questions: {email}.",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      sections: [
        {
          heading: "1. Who we are",
          body: ["The data controller is {company}, {address}. Contact: {email}."],
        },
        {
          heading: "2. Data we collect",
          body: [
            "Account data: email, optional name, hashed password, language and plan.",
            "Usage data: searches, analyses, saved products, uploaded CSV files and product photos, and counters needed for plan limits.",
            "Billing data: subscription status and identifiers from payment providers. Card details are handled by the providers, not by us.",
            "Technical data: a session cookie (to keep you logged in) and a language cookie. We do not use advertising cookies.",
          ],
        },
        {
          heading: "3. Why we use it",
          body: [
            "To provide and secure the service, enforce plan limits, process payments, answer support requests and meet legal obligations. Legal bases: performance of our contract with you, legitimate interests (security, improving the service) and legal obligations.",
          ],
        },
        {
          heading: "4. Who we share it with",
          body: [
            "Payment providers: Stripe, LiqPay (PrivatBank), monobank (Universal Bank).",
            "Data providers that answer your queries: CJ Dropshipping, eBay, SerpApi (Google Shopping / Google Lens — receives the product photos you search with), currency-rate services.",
            "Hosting and infrastructure providers. We do not sell personal data.",
          ],
        },
        {
          heading: "5. Retention",
          body: [
            "Account data is kept while your account exists and deleted within 30 days after you ask us to delete it, except records we must keep for accounting. Uploaded product photos are kept for up to 30 days.",
          ],
        },
        {
          heading: "6. Your rights",
          body: [
            "You can request access, correction, deletion or export of your data, object to processing, and complain to a supervisory authority (in Ukraine: the Ukrainian Parliament Commissioner for Human Rights; in the EU: your local data protection authority). Write to {email}.",
          ],
        },
      ],
    },
    refunds: {
      title: "Refund Policy",
      sections: [
        {
          heading: "Cancelling",
          body: [
            "You can cancel your subscription at any time on the Plan & billing page. No further payments are taken, and your paid plan stays active until the end of the current billing period.",
          ],
        },
        {
          heading: "Refunds",
          body: [
            "Because paid features are available immediately, payments for a started billing period are generally not refunded.",
            "If you were charged by mistake, charged twice, or could not use the service because of a fault on our side, write to {email} within 14 days of the charge and we will refund the affected amount to the original payment method.",
            "This does not limit any rights you have under consumer protection law in your country.",
          ],
        },
        {
          heading: "Processing time",
          body: ["Approved refunds are sent within 5 business days; your bank may take up to 30 days to show them."],
        },
      ],
    },
    contacts: {
      title: "Contacts",
      sections: [
        {
          heading: "Company",
          body: ["{company}", "Address: {address}", "Tax ID / EDRPOU: {taxId}"],
        },
        { heading: "Support", body: ["Email: {email}", "We reply within 2 business days."] },
      ],
    },
  },
  uk: {
    terms: {
      title: "Умови використання",
      sections: [
        {
          heading: "1. Сервіс",
          body: [
            "Dropio («ми», «сервіс») належить {company}. Сервіс допомагає продавцям досліджувати товари: порівнювати ціни постачальників із цінами маркетплейсів та оцінювати доставку, митні платежі, податки й комісії.",
            "Усі ціни, маржа, мито та комісії — це оцінки на основі сторонніх даних і опублікованих правил. Вони не є фінансовою, податковою чи юридичною порадою; ми не гарантуємо їхньої точності чи результатів продажів.",
          ],
        },
        {
          heading: "2. Обліковий запис",
          body: [
            "Ви маєте вказати дійсну електронну пошту та не розголошувати пароль. Ви відповідаєте за дії у своєму обліковому записі.",
            "Для оформлення платного тарифу вам має бути щонайменше 18 років або вік повноліття у вашій країні.",
          ],
        },
        {
          heading: "3. Тарифи та оплата",
          body: [
            "Платні тарифи — це щомісячні підписки, що подовжуються автоматично до скасування. Ціни вказано на сторінці «Тариф і оплата» в доларах США (картка через Stripe) або в гривнях (LiqPay, monobank).",
            "Платежі обробляють наші платіжні партнери; ми не зберігаємо повні дані вашої картки. Ліміти тарифів (аналізи, пошуки, країни на день) описано на сторінці тарифів.",
          ],
        },
        {
          heading: "4. Скасування",
          body: [
            "Ви можете скасувати підписку будь-коли на сторінці «Тариф і оплата». Тариф діє до кінця оплаченого періоду й більше не подовжується. Повернення коштів описано в Політиці повернення.",
          ],
        },
        {
          heading: "5. Допустиме використання",
          body: [
            "Заборонено зловживати сервісом: намагатися обійти захист, перепродавати доступ, перевантажувати систему, автоматично збирати дані сервісу або завантажувати матеріали, на які у вас немає прав.",
            "Ми можемо призупинити обліковий запис у разі порушення цих умов.",
          ],
        },
        {
          heading: "6. Ваші матеріали",
          body: [
            "Файли та зображення, які ви завантажуєте (CSV-списки, фото товарів), залишаються вашими. Ви дозволяєте нам обробляти їх і передавати постачальникам даних, потрібним для відповіді на ваш запит (наприклад, сервісам пошуку за зображенням), лише для надання сервісу.",
          ],
        },
        {
          heading: "7. Відповідальність",
          body: [
            "Сервіс надається «як є». У межах, дозволених законом, наша сукупна відповідальність обмежена сумою, яку ви сплатили нам за 3 місяці до претензії. Ми не відповідаємо за втрачений прибуток чи бізнес-рішення, ухвалені на основі оцінок.",
          ],
        },
        {
          heading: "8. Зміни та застосовне право",
          body: [
            "Ми можемо оновлювати ці умови й повідомимо про суттєві зміни електронною поштою або в застосунку. Умови регулюються законодавством України без обмеження обов’язкових прав споживачів у вашій країні.",
            "Питання: {email}.",
          ],
        },
      ],
    },
    privacy: {
      title: "Політика конфіденційності",
      sections: [
        { heading: "1. Хто ми", body: ["Володілець персональних даних — {company}, {address}. Контакт: {email}."] },
        {
          heading: "2. Які дані ми збираємо",
          body: [
            "Дані облікового запису: email, ім’я (за бажанням), хеш пароля, мова та тариф.",
            "Дані використання: пошуки, аналізи, збережені товари, завантажені CSV-файли й фото товарів, лічильники для лімітів тарифу.",
            "Платіжні дані: статус підписки та ідентифікатори від платіжних систем. Дані карток обробляють платіжні системи, а не ми.",
            "Технічні дані: cookie сесії (щоб ви залишалися в системі) та cookie мови. Рекламних cookie ми не використовуємо.",
          ],
        },
        {
          heading: "3. Навіщо ми їх використовуємо",
          body: [
            "Щоб надавати й захищати сервіс, застосовувати ліміти тарифів, приймати платежі, відповідати на звернення та виконувати вимоги закону. Підстави: виконання договору з вами, законний інтерес (безпека, покращення сервісу) та юридичні обов’язки.",
          ],
        },
        {
          heading: "4. Кому ми їх передаємо",
          body: [
            "Платіжні системи: Stripe, LiqPay (ПриватБанк), monobank (Універсал Банк).",
            "Постачальники даних, що відповідають на ваші запити: CJ Dropshipping, eBay, SerpApi (Google Shopping / Google Lens — отримує фото товарів, за якими ви шукаєте), сервіси курсів валют.",
            "Хостинг та інфраструктурні сервіси. Ми не продаємо персональні дані.",
          ],
        },
        {
          heading: "5. Строк зберігання",
          body: [
            "Дані облікового запису зберігаються, поки існує обліковий запис, і видаляються протягом 30 днів після вашого запиту, крім записів, які ми зобов’язані зберігати для бухгалтерії. Завантажені фото товарів зберігаються до 30 днів.",
          ],
        },
        {
          heading: "6. Ваші права",
          body: [
            "Ви можете отримати доступ до своїх даних, виправити, видалити чи експортувати їх, заперечити проти обробки та поскаржитися до наглядового органу (в Україні — Уповноважений Верховної Ради України з прав людини; в ЄС — ваш місцевий орган захисту даних). Пишіть на {email}.",
          ],
        },
      ],
    },
    refunds: {
      title: "Політика повернення коштів",
      sections: [
        {
          heading: "Скасування",
          body: [
            "Ви можете скасувати підписку будь-коли на сторінці «Тариф і оплата». Подальші списання не відбуваються, а платний тариф діє до кінця поточного оплаченого періоду.",
          ],
        },
        {
          heading: "Повернення",
          body: [
            "Оскільки платні функції стають доступними одразу, оплату за розпочатий період зазвичай не повертаємо.",
            "Якщо кошти списано помилково, двічі або ви не змогли користуватися сервісом через збій на нашому боці — напишіть на {email} протягом 14 днів після списання, і ми повернемо відповідну суму на картку, з якої було оплачено.",
            "Це не обмежує ваших прав за законодавством про захист прав споживачів у вашій країні.",
          ],
        },
        { heading: "Строки", body: ["Схвалені повернення надсилаємо протягом 5 робочих днів; банку може знадобитися до 30 днів, щоб їх зарахувати."] },
      ],
    },
    contacts: {
      title: "Контакти",
      sections: [
        { heading: "Компанія", body: ["{company}", "Адреса: {address}", "ІПН / ЄДРПОУ: {taxId}"] },
        { heading: "Підтримка", body: ["Email: {email}", "Відповідаємо протягом 2 робочих днів."] },
      ],
    },
  },
};
