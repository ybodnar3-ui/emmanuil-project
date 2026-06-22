/**
 * Legal copy for the Privacy Policy and Terms pages, keyed by locale. This is a
 * plain-language STARTING DRAFT that describes the app's actual data practices —
 * NOT lawyer-reviewed legal advice. The pages render a visible notice saying so.
 * Operator identity lives here so it is trivial to change later.
 */
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; sections: LegalSection[] };

export const OPERATOR = {
  name: "Yurii Bodnar",
  contact: "ybodnar3@gmail.com",
  jurisdiction: "Ukraine",
} as const;

export const EFFECTIVE_DATE = "2026-06-22";

export const PRIVACY: Record<"en" | "uk", LegalDoc> = {
  en: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Who we are",
        body: [
          `Emmanuil is operated by ${OPERATOR.name}, an individual developer. For any privacy question, contact ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "What we collect",
        body: [
          "Your account email address, provided when you sign in.",
          "The information you choose to store about the people in your network: names, notes and facts, interactions, key dates, and any photos you upload.",
          "When you use voice capture, your audio is sent for transcription and is not stored after the text is produced.",
        ],
      },
      {
        heading: "How we use your data",
        body: [
          "To provide the service: storing your network, generating reminders, and answering your questions about the people you track.",
          "We do not sell your data and do not use it for advertising.",
        ],
      },
      {
        heading: "Service providers",
        body: [
          "We share data with providers only as needed to run the app: Anthropic (Claude) powers the AI assistant and suggestions; Groq (Whisper) transcribes voice; Supabase provides the database, file storage, and authentication; Vercel hosts the application.",
          "These providers process your data on our behalf to deliver their part of the service.",
        ],
      },
      {
        heading: "Cookies",
        body: [
          "We use only essential cookies: one to keep you signed in, and one to remember your language. We do not use analytics or advertising cookies.",
        ],
      },
      {
        heading: "Retention and deletion",
        body: [
          "We keep your data for as long as your account exists.",
          `You can ask us to delete your account and associated data at any time by writing to ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "Your responsibility for others' data",
        body: [
          "You decide what to store about other people. You are responsible for having a lawful basis to keep that information and for honouring any request from those people regarding their data.",
        ],
      },
      {
        heading: "Governing law and contact",
        body: [
          `This policy is governed by the laws of ${OPERATOR.jurisdiction}. Questions: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
  uk: {
    title: "Політика конфіденційності",
    sections: [
      {
        heading: "Хто ми",
        body: [
          `Emmanuil керує ${OPERATOR.name}, незалежний розробник-фізособа. З будь-яких питань щодо конфіденційності пишіть на ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "Які дані ми збираємо",
        body: [
          "Електронну адресу вашого акаунта, яку ви вказуєте під час входу.",
          "Інформацію, яку ви самі зберігаєте про людей зі свого оточення: імена, нотатки й факти, взаємодії, ключові дати та завантажені фото.",
          "Коли ви користуєтеся голосовим введенням, ваше аудіо надсилається на транскрибацію і не зберігається після отримання тексту.",
        ],
      },
      {
        heading: "Як ми використовуємо дані",
        body: [
          "Щоб надавати сервіс: зберігати ваше оточення, формувати нагадування та відповідати на запитання про людей, яких ви ведете.",
          "Ми не продаємо ваші дані й не використовуємо їх для реклами.",
        ],
      },
      {
        heading: "Постачальники послуг",
        body: [
          "Ми передаємо дані постачальникам лише в обсязі, потрібному для роботи застосунку: Anthropic (Claude) забезпечує AI-асистента та підказки; Groq (Whisper) транскрибує голос; Supabase надає базу даних, сховище файлів і автентифікацію; Vercel хостить застосунок.",
          "Ці постачальники обробляють ваші дані від нашого імені, щоб виконати свою частину сервісу.",
        ],
      },
      {
        heading: "Файли cookie",
        body: [
          "Ми використовуємо лише необхідні cookie: один — щоб тримати вас у системі, інший — щоб запам’ятати мову. Аналітичних чи рекламних cookie ми не використовуємо.",
        ],
      },
      {
        heading: "Зберігання та видалення",
        body: [
          "Ми зберігаємо ваші дані, доки існує ваш акаунт.",
          `Ви можете будь-коли попросити видалити акаунт і пов’язані дані, написавши на ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "Ваша відповідальність за дані інших",
        body: [
          "Ви вирішуєте, що зберігати про інших людей. Ви відповідаєте за наявність законної підстави зберігати цю інформацію та за виконання запитів цих людей щодо їхніх даних.",
        ],
      },
      {
        heading: "Застосовне право і контакт",
        body: [
          `Ця політика регулюється законодавством: ${OPERATOR.jurisdiction}. Питання: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
};

export const TERMS: Record<"en" | "uk", LegalDoc> = {
  en: {
    title: "Terms of Service",
    sections: [
      {
        heading: "Acceptance",
        body: [
          "By using Emmanuil you agree to these terms. If you do not agree, do not use the service.",
        ],
      },
      {
        heading: "The service is provided “as is”",
        body: [
          "Emmanuil is provided without warranties of any kind. We do not guarantee it will be uninterrupted or error-free.",
        ],
      },
      {
        heading: "AI output",
        body: [
          "The assistant's answers, briefs, and suggested reminders are generated by AI and may be inaccurate or incomplete. Do not rely on them as professional advice.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: [
          "You are responsible for the data you enter and for using the service lawfully, including any consent needed to store information about other people.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Do not use the service for unlawful purposes, to harass anyone, or to attempt to disrupt or reverse-engineer it. We may suspend or terminate accounts that abuse the service.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "To the maximum extent permitted by law, we are not liable for any indirect or consequential damages arising from your use of the service.",
        ],
      },
      {
        heading: "Changes and governing law",
        body: [
          "We may update these terms; continued use after a change means you accept it.",
          `These terms are governed by the laws of ${OPERATOR.jurisdiction}. Questions: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
  uk: {
    title: "Умови користування",
    sections: [
      {
        heading: "Прийняття умов",
        body: [
          "Користуючись Emmanuil, ви погоджуєтеся з цими умовами. Якщо не згодні — не користуйтеся сервісом.",
        ],
      },
      {
        heading: "Сервіс надається “як є”",
        body: [
          "Emmanuil надається без жодних гарантій. Ми не гарантуємо безперебійної чи безпомилкової роботи.",
        ],
      },
      {
        heading: "Результати AI",
        body: [
          "Відповіді асистента, довідки та запропоновані нагадування генеруються AI і можуть бути неточними чи неповними. Не покладайтеся на них як на фахову пораду.",
        ],
      },
      {
        heading: "Ваші обов’язки",
        body: [
          "Ви відповідаєте за дані, які вводите, і за законне використання сервісу, зокрема за згоду, потрібну для зберігання інформації про інших людей.",
        ],
      },
      {
        heading: "Допустиме використання",
        body: [
          "Не використовуйте сервіс для незаконних цілей, переслідування або спроб порушити чи зворотно розробити його. Ми можемо призупиняти чи закривати акаунти, що зловживають сервісом.",
        ],
      },
      {
        heading: "Обмеження відповідальності",
        body: [
          "У максимально дозволених законом межах ми не відповідаємо за непрямі чи похідні збитки, що виникли через використання сервісу.",
        ],
      },
      {
        heading: "Зміни та застосовне право",
        body: [
          "Ми можемо оновлювати ці умови; продовження користування після зміни означає вашу згоду.",
          `Ці умови регулюються законодавством: ${OPERATOR.jurisdiction}. Питання: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
};
