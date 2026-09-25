/**
 * General FAQs for /faq (and the home-page teaser). Service-specific FAQs live in each
 * src/content/services/*.md file. Answers are rendered as HTML, so links are allowed.
 * Owner to confirm every answer. Do not add credentials, stats or prices here.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

export const faqGroups: FaqGroup[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        question: 'How do I get started?',
        answer:
          'Send a message on WhatsApp, call, or use the <a href="/contact">contact form</a>. Say which service you need and a little about your situation. You will get a checklist of documents and a quote before any work starts.',
      },
      {
        question: 'How much does it cost?',
        answer:
          'Pricing is on request, because the work depends on your income sources, the number of returns and how organised your documents are. You will get a clear quote upfront, and nothing starts until you agree to it.',
      },
      {
        question: 'Do I need to meet in person?',
        answer:
          'Most work can be done over WhatsApp, phone and email. Documents can be shared digitally, and returns are e-verified online. If you prefer to meet, ask when you get in touch.',
      },
      {
        question: 'Who will be handling my work?',
        answer:
          'GrowthSense is run by Avinash Thakur, an individual tax practitioner. You deal with the same person from the first message to the final acknowledgement.',
      },
    ],
  },
  {
    id: 'documents-privacy',
    title: 'Documents and privacy',
    items: [
      {
        question: 'How do I share my documents safely?',
        answer:
          'Share documents over WhatsApp or in person once you have agreed to go ahead. Please do not send PAN, Aadhaar or other documents through the website contact form. See the <a href="/privacy">privacy notice</a> for how your information is handled.',
      },
      {
        question: 'Do you need my income tax or GST portal password?',
        answer:
          'Filing usually requires access to your portal account. Whenever possible, you log in yourself or enter OTPs as they arrive. If you do share a password, you can change it once the work is done.',
      },
      {
        question: 'Is anything filed without my approval?',
        answer:
          'No. You receive a summary of the return or statement first, and it is filed only after you confirm. You get a copy of the acknowledgement afterwards.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns, refunds and notices',
    items: [
      {
        question: 'How long does my refund take?',
        answer:
          'Refunds are issued by the income tax department after your return is e-verified and processed. That often takes a few weeks but can take longer. You can track the status on <a href="https://www.incometax.gov.in/iec/foportal/" rel="noopener">incometax.gov.in</a>, and help is available if it gets stuck.',
      },
      {
        question: 'I got a notice from the income tax department. What should I do?',
        answer:
          'Don\'t ignore it, and check that it is genuine. Real notices appear in your account on the income tax portal. Share a copy and it will be explained in plain language, along with what a response would involve.',
      },
      {
        question: 'Can you help with previous years\' returns?',
        answer:
          'Often, yes. A belated or updated return may be possible within the time limits allowed by law. Share the years concerned and they will be checked.',
      },
    ],
  },
  {
    id: 'calculators',
    title: 'Calculators',
    items: [
      {
        question: 'Are the calculators on this site accurate?',
        answer:
          'They are built to follow the rules published for the year shown on each calculator. They are estimates for information only, not tax advice. Your actual tax depends on your full facts. See the <a href="/disclaimer">disclaimer</a>.',
      },
      {
        question: 'Do the calculators store what I enter?',
        answer:
          'No. The calculators run in your browser and the numbers you type are not sent to anyone.',
      },
    ],
  },
];

export const allFaqs: FaqItem[] = faqGroups.flatMap((g) => g.items);
