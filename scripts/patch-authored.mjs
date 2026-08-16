/**
 * One-off content patch applying the client's 14 August 2026 update brief to
 * src/content/authored/{loc}.json.
 *
 *   node scripts/patch-authored.mjs
 *
 * That brief supersedes the 10 August content pack for: the domain and email
 * addresses, the governance list, the Founding Book copy, the order-request
 * flow and the newsletter. FR and EN wording is reproduced verbatim from the
 * brief. DE and IT are translated by the developer and need client validation
 * - they are listed in CONTENT.md alongside the other authored strings.
 *
 * Kept in the repository rather than run and deleted so the provenance of
 * every one of these strings stays auditable.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The six approved people. Roles FR/EN verbatim from the brief §5. */
const GOVERNANCE = {
  fr: [
    ['Martial HAPPI', 'Fondateur et Président', 'm.happi@mhsv.ch'],
    ['Marc DJEA', 'Vice-président', 'infos@mhsv.ch'],
    ['Laetitia PILLER', 'Membre du Comité - Responsable de la communication', 'infos@mhsv.ch'],
    ['Paule ESSAI', 'Secrétaire générale', 'infos@mhsv.ch'],
    [
      'Diego FUIANO',
      'Coordinateur Web & Digital et développement institutionnel et des partenariats - Italie',
      'infos@mhsv.ch',
    ],
    ['Xavier MARTI', 'Directeur du développement institutionnel et des partenariats', 'infos@mhsv.ch'],
  ],
  en: [
    ['Martial HAPPI', 'Founder and President', 'm.happi@mhsv.ch'],
    ['Marc DJEA', 'Vice-President', 'infos@mhsv.ch'],
    ['Laetitia PILLER', 'Committee Member - Communications Officer', 'infos@mhsv.ch'],
    ['Paule ESSAI', 'Secretary General', 'infos@mhsv.ch'],
    [
      'Diego FUIANO',
      'Web & Digital Coordinator and Institutional Development & Partnerships - Italy',
      'infos@mhsv.ch',
    ],
    ['Xavier MARTI', 'Director of Institutional Development and Partnerships', 'infos@mhsv.ch'],
  ],
  de: [
    ['Martial HAPPI', 'Gründer und Präsident', 'm.happi@mhsv.ch'],
    ['Marc DJEA', 'Vizepräsident', 'infos@mhsv.ch'],
    ['Laetitia PILLER', 'Vorstandsmitglied - Verantwortliche Kommunikation', 'infos@mhsv.ch'],
    ['Paule ESSAI', 'Generalsekretärin', 'infos@mhsv.ch'],
    [
      'Diego FUIANO',
      'Koordinator Web & Digital sowie institutionelle Entwicklung und Partnerschaften - Italien',
      'infos@mhsv.ch',
    ],
    ['Xavier MARTI', 'Direktor Institutionelle Entwicklung und Partnerschaften', 'infos@mhsv.ch'],
  ],
  it: [
    ['Martial HAPPI', 'Fondatore e Presidente', 'm.happi@mhsv.ch'],
    ['Marc DJEA', 'Vicepresidente', 'infos@mhsv.ch'],
    ['Laetitia PILLER', 'Membro del Comitato - Responsabile della comunicazione', 'infos@mhsv.ch'],
    ['Paule ESSAI', 'Segretaria generale', 'infos@mhsv.ch'],
    [
      'Diego FUIANO',
      'Coordinatore Web & Digital e sviluppo istituzionale e delle partnership - Italia',
      'infos@mhsv.ch',
    ],
    ['Xavier MARTI', 'Direttore dello sviluppo istituzionale e delle partnership', 'infos@mhsv.ch'],
  ],
};

const PATCH = {
  fr: {
    nav: {
      items: [
        { id: 'about', label: 'Qui sommes-nous' },
        { id: 'vision', label: 'Vision 2035' },
        { id: 'method', label: 'Méthodologie' },
        { id: 'programmes', label: 'Programmes' },
        { id: 'team', label: 'Gouvernance' },
        { id: 'book', label: 'Le Livre' },
        { id: 'newsletter', label: 'Newsletter' },
        { id: 'contact', label: 'Contact' },
      ],
    },
    sections: {
      founding: {
        title: 'Programmes fondateurs & tarifs',
        lead: 'Les deux programmes fondateurs de la première année de déploiement, et le tarif de lancement.',
      },
      team: {
        title: 'Organisation & gouvernance',
        lead: 'Présentation sans photographies pour cette phase. Les fiches restent modulaires afin de permettre l’ajout ultérieur de photos, biographies et membres après validation.',
        emailPending: 'Adresse MHSV® à venir',
        emailPendingHint: 'L’adresse professionnelle sera publiée après validation écrite.',
      },
      book: {
        title: 'Le Livre Fondateur Premium',
        lead: 'LE LIVRE FONDATEUR PREMIUM MHSV® - ÉDITION FONDATRICE 2026',
        body: 'Publication institutionnelle exclusive, le Livre Fondateur Premium présente la vision, les programmes, la gouvernance, l’impact et la feuille de route de MHSV®. Son contenu stratégique et méthodologique n’est pas proposé en téléchargement public. Les éditions française et anglaise peuvent être commandées depuis le site, sous réserve de disponibilité et de confirmation par MHSV®.',
        notice: 'Aucun téléchargement du livre complet n’est proposé. Seules les couvertures validées sont publiées.',
        coverAltFr: 'Couverture du Livre Fondateur MHSV® - édition française',
        coverAltEn: 'Couverture du Livre Fondateur MHSV® - édition anglaise',
        ctaLabel: 'Commander le livre',
        qrCaption: 'Découvrez le Livre Fondateur Premium MHSV® et transmettez votre demande de commande.',
        qrAlt: 'Code QR vers la page du Livre Fondateur MHSV®',
      },
      newsletter: {
        title: 'Restez informé(e) de l’actualité MHSV®',
        lead: 'Recevez nos actualités institutionnelles, l’évolution de nos programmes, nos projets, nos événements et nos initiatives internationales.',
      },
      contact: {
        lead: 'Une question, un projet, une demande d’évaluation ? Écrivez-nous.',
        detailsTitle: 'Coordonnées',
        formTitle: 'Formulaire de contact',
        websiteLabel: 'Site',
        emailLabel: 'Contact institutionnel',
        founderLabel: 'Fondateur et Président',
        email: 'infos@mhsv.ch',
        founderEmail: 'm.happi@mhsv.ch',
      },
    },
    bookOrder: {
      title: 'Demande de commande',
      intro: 'Il s’agit d’une demande de commande, non d’un paiement. MHSV® vous contactera pour confirmer les modalités.',
      edition: 'Édition',
      editionFr: 'Français',
      editionEn: 'Anglais',
      quantity: 'Quantité',
      organisation: 'Organisation',
      country: 'Pays',
      consent: 'J’accepte que MHSV® utilise mes données pour traiter ma demande de commande.',
      submit: 'Envoyer ma demande',
      successTitle: 'Demande transmise',
      successBody: 'Votre demande a bien été transmise. MHSV® vous contactera pour confirmer la disponibilité, le prix, la livraison et les modalités de paiement.',
      errors: {
        edition: 'Merci de choisir une édition.',
        quantity: 'Merci d’indiquer une quantité valide.',
        organisation: 'Merci d’indiquer votre organisation.',
        country: 'Merci d’indiquer votre pays.',
        consent: 'Votre consentement est nécessaire pour envoyer la demande.',
      },
    },
    newsletterForm: {
      firstName: 'Prénom',
      email: 'E-mail',
      language: 'Langue préférée',
      consent: 'J’accepte de recevoir la newsletter MHSV® et je peux me désinscrire à tout moment.',
      submit: 'Je m’inscris',
      successTitle: 'Presque terminé',
      successBody: 'Merci. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien qu’il contient pour valider votre inscription.',
      errors: {
        email: 'Merci d’indiquer une adresse e-mail valide.',
        language: 'Merci de choisir une langue.',
        consent: 'Votre consentement est nécessaire pour vous inscrire.',
      },
      privacyNote: 'Vos données servent uniquement à l’envoi de la newsletter. Un lien de désinscription figure dans chaque message.',
    },
    footer: {
      navTitle: 'Rubriques',
      legalTitle: 'Informations',
      summary: 'MHSV® - Centre International de Développement et de Transition | Genève - Suisse | www.mhsv.ch | infos@mhsv.ch',
    },
  },

  en: {
    nav: {
      items: [
        { id: 'about', label: 'Who we are' },
        { id: 'vision', label: 'Vision 2035' },
        { id: 'method', label: 'Methodology' },
        { id: 'programmes', label: 'Programmes' },
        { id: 'team', label: 'Governance' },
        { id: 'book', label: 'The Book' },
        { id: 'newsletter', label: 'Newsletter' },
        { id: 'contact', label: 'Contact' },
      ],
    },
    sections: {
      founding: {
        title: 'Founding programmes & fees',
        lead: 'The two founding programmes for the first deployment year, and the launch rate.',
      },
      team: {
        title: 'Organisation & governance',
        lead: 'Presented without photographs at this stage. Cards remain modular so photos, biographies and members can be added later after approval.',
        emailPending: 'MHSV® address to come',
        emailPendingHint: 'The professional address will be published after written approval.',
      },
      book: {
        title: 'The Premium Founding Book',
        lead: 'THE MHSV® PREMIUM FOUNDING BOOK - FOUNDING EDITION 2026',
        body: 'An exclusive institutional publication, the Premium Founding Book presents MHSV®’s vision, programmes, governance, impact and roadmap. Its strategic and methodological content is not available as a public download. French and English editions may be ordered through the website, subject to availability and confirmation by MHSV®.',
        notice: 'No download of the complete book is offered. Only the approved covers are published.',
        coverAltFr: 'MHSV® Founding Book cover - French edition',
        coverAltEn: 'MHSV® Founding Book cover - English edition',
        ctaLabel: 'Order the book',
        qrCaption: 'Discover the MHSV® Premium Founding Book and submit your order request.',
        qrAlt: 'QR code linking to the MHSV® Founding Book page',
      },
      newsletter: {
        title: 'Stay informed about MHSV®',
        lead: 'Receive institutional news, programme updates, projects, events and international initiatives.',
      },
      contact: {
        lead: 'A question, a project, a request for an assessment? Write to us.',
        detailsTitle: 'Details',
        formTitle: 'Contact form',
        websiteLabel: 'Website',
        emailLabel: 'Institutional contact',
        founderLabel: 'Founder and President',
        email: 'infos@mhsv.ch',
        founderEmail: 'm.happi@mhsv.ch',
      },
    },
    bookOrder: {
      title: 'Order request',
      intro: 'This is an order request, not a payment. MHSV® will contact you to confirm the arrangements.',
      edition: 'Edition',
      editionFr: 'French',
      editionEn: 'English',
      quantity: 'Quantity',
      organisation: 'Organisation',
      country: 'Country',
      consent: 'I agree that MHSV® may use my data to process my order request.',
      submit: 'Send my request',
      successTitle: 'Request received',
      successBody: 'Your request has been received. MHSV® will contact you to confirm availability, price, delivery and payment arrangements.',
      errors: {
        edition: 'Please choose an edition.',
        quantity: 'Please enter a valid quantity.',
        organisation: 'Please enter your organisation.',
        country: 'Please enter your country.',
        consent: 'Your consent is required to send the request.',
      },
    },
    newsletterForm: {
      firstName: 'First name',
      email: 'Email',
      language: 'Preferred language',
      consent: 'I agree to receive the MHSV® newsletter and may unsubscribe at any time.',
      submit: 'Subscribe',
      successTitle: 'Almost there',
      successBody: 'Thank you. A confirmation email is on its way - click the link inside it to complete your subscription.',
      errors: {
        email: 'Please enter a valid email address.',
        language: 'Please choose a language.',
        consent: 'Your consent is required to subscribe.',
      },
      privacyNote: 'Your data is used only to send the newsletter. Every message contains an unsubscribe link.',
    },
    footer: {
      navTitle: 'Sections',
      legalTitle: 'Information',
      summary: 'MHSV® - International Centre for Development and Transition | Geneva - Switzerland | www.mhsv.ch | infos@mhsv.ch',
    },
  },

  de: {
    nav: {
      items: [
        { id: 'about', label: 'Über uns' },
        { id: 'vision', label: 'Vision 2035' },
        { id: 'method', label: 'Methodologie' },
        { id: 'programmes', label: 'Programme' },
        { id: 'team', label: 'Governance' },
        { id: 'book', label: 'Das Buch' },
        { id: 'newsletter', label: 'Newsletter' },
        { id: 'contact', label: 'Kontakt' },
      ],
    },
    sections: {
      founding: {
        title: 'Gründungsprogramme & Tarife',
        lead: 'Die beiden Gründungsprogramme des ersten Umsetzungsjahres und der Einführungstarif.',
      },
      team: {
        title: 'Organisation & Governance',
        lead: 'Darstellung ohne Fotos in dieser Phase. Die Karten bleiben modular, damit Fotos, Biografien und weitere Mitglieder nach Validierung ergänzt werden können.',
        emailPending: 'MHSV®-Adresse folgt',
        emailPendingHint: 'Die berufliche Adresse wird nach schriftlicher Freigabe veröffentlicht.',
      },
      book: {
        title: 'Das Premium-Gründungsbuch',
        lead: 'DAS MHSV® PREMIUM FOUNDING BOOK - GRÜNDUNGSAUSGABE 2026',
        body: 'Als exklusive institutionelle Publikation stellt das Premium-Gründungsbuch Vision, Programme, Governance, Wirkung und Roadmap von MHSV® vor. Die strategischen und methodologischen Inhalte stehen nicht zum öffentlichen Download bereit. Die französische und die englische Ausgabe können über die Website bestellt werden, vorbehältlich Verfügbarkeit und Bestätigung durch MHSV®.',
        notice: 'Es wird kein Download des vollständigen Buches angeboten. Veröffentlicht werden ausschliesslich die freigegebenen Titelseiten.',
        coverAltFr: 'Titelseite des MHSV®-Gründungsbuchs - französische Ausgabe',
        coverAltEn: 'Titelseite des MHSV®-Gründungsbuchs - englische Ausgabe',
        ctaLabel: 'Buch bestellen',
        qrCaption: 'Entdecken Sie das MHSV® Premium Founding Book und senden Sie Ihre Bestellanfrage.',
        qrAlt: 'QR-Code zur Seite des MHSV®-Gründungsbuchs',
      },
      newsletter: {
        title: 'Bleiben Sie über MHSV® informiert',
        lead: 'Erhalten Sie institutionelle Neuigkeiten, Programmentwicklungen, Projekte, Veranstaltungen und internationale Initiativen.',
      },
      contact: {
        lead: 'Eine Frage, ein Projekt, eine Anfrage für eine Beurteilung? Schreiben Sie uns.',
        detailsTitle: 'Kontaktangaben',
        formTitle: 'Kontaktformular',
        websiteLabel: 'Website',
        emailLabel: 'Institutioneller Kontakt',
        founderLabel: 'Gründer und Präsident',
        email: 'infos@mhsv.ch',
        founderEmail: 'm.happi@mhsv.ch',
      },
    },
    bookOrder: {
      title: 'Bestellanfrage',
      intro: 'Dies ist eine Bestellanfrage, keine Zahlung. MHSV® wird Sie zur Bestätigung der Modalitäten kontaktieren.',
      edition: 'Ausgabe',
      editionFr: 'Französisch',
      editionEn: 'Englisch',
      quantity: 'Anzahl',
      organisation: 'Organisation',
      country: 'Land',
      consent: 'Ich bin damit einverstanden, dass MHSV® meine Daten zur Bearbeitung meiner Bestellanfrage verwendet.',
      submit: 'Anfrage senden',
      successTitle: 'Anfrage erhalten',
      successBody: 'Ihre Anfrage ist bei uns eingegangen. MHSV® wird Sie kontaktieren, um Verfügbarkeit, Preis, Lieferung und Zahlungsmodalitäten zu bestätigen.',
      errors: {
        edition: 'Bitte wählen Sie eine Ausgabe.',
        quantity: 'Bitte geben Sie eine gültige Anzahl an.',
        organisation: 'Bitte geben Sie Ihre Organisation an.',
        country: 'Bitte geben Sie Ihr Land an.',
        consent: 'Ihre Einwilligung ist für das Senden der Anfrage erforderlich.',
      },
    },
    newsletterForm: {
      firstName: 'Vorname',
      email: 'E-Mail',
      language: 'Bevorzugte Sprache',
      consent: 'Ich bin damit einverstanden, den MHSV®-Newsletter zu erhalten, und kann mich jederzeit abmelden.',
      submit: 'Anmelden',
      successTitle: 'Fast geschafft',
      successBody: 'Vielen Dank. Eine Bestätigungs-E-Mail ist unterwegs - klicken Sie auf den darin enthaltenen Link, um Ihre Anmeldung abzuschliessen.',
      errors: {
        email: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
        language: 'Bitte wählen Sie eine Sprache.',
        consent: 'Ihre Einwilligung ist für die Anmeldung erforderlich.',
      },
      privacyNote: 'Ihre Daten werden ausschliesslich für den Versand des Newsletters verwendet. Jede Nachricht enthält einen Abmeldelink.',
    },
    footer: {
      navTitle: 'Rubriken',
      legalTitle: 'Informationen',
      summary: 'MHSV® - Internationales Zentrum für Entwicklung und Transition | Genf - Schweiz | www.mhsv.ch | infos@mhsv.ch',
    },
  },

  it: {
    nav: {
      items: [
        { id: 'about', label: 'Chi siamo' },
        { id: 'vision', label: 'Visione 2035' },
        { id: 'method', label: 'Metodologia' },
        { id: 'programmes', label: 'Programmi' },
        { id: 'team', label: 'Governance' },
        { id: 'book', label: 'Il Libro' },
        { id: 'newsletter', label: 'Newsletter' },
        { id: 'contact', label: 'Contatti' },
      ],
    },
    sections: {
      founding: {
        title: 'Programmi fondatori e tariffe',
        lead: 'I due programmi fondatori del primo anno di sviluppo e la tariffa di lancio.',
      },
      team: {
        title: 'Organizzazione e governance',
        lead: 'Presentazione senza fotografie in questa fase. Le schede restano modulari per consentire l’aggiunta successiva di foto, biografie e membri dopo la validazione.',
        emailPending: 'Indirizzo MHSV® in arrivo',
        emailPendingHint: 'L’indirizzo professionale sarà pubblicato dopo validazione scritta.',
      },
      book: {
        title: 'Il Libro Fondatore Premium',
        lead: 'IL LIBRO FONDATORE PREMIUM MHSV® - EDIZIONE FONDATRICE 2026',
        body: 'Pubblicazione istituzionale esclusiva, il Libro Fondatore Premium presenta la visione, i programmi, la governance, l’impatto e la roadmap di MHSV®. I suoi contenuti strategici e metodologici non sono disponibili per il download pubblico. Le edizioni francese e inglese possono essere ordinate dal sito, salvo disponibilità e conferma da parte di MHSV®.',
        notice: 'Non è offerto alcun download del libro completo. Sono pubblicate soltanto le copertine approvate.',
        coverAltFr: 'Copertina del Libro Fondatore MHSV® - edizione francese',
        coverAltEn: 'Copertina del Libro Fondatore MHSV® - edizione inglese',
        ctaLabel: 'Ordina il libro',
        qrCaption: 'Scoprite il Libro Fondatore Premium MHSV® e inviate la vostra richiesta di ordine.',
        qrAlt: 'Codice QR verso la pagina del Libro Fondatore MHSV®',
      },
      newsletter: {
        title: 'Restate informati su MHSV®',
        lead: 'Ricevete le nostre notizie istituzionali, gli aggiornamenti dei programmi, i progetti, gli eventi e le iniziative internazionali.',
      },
      contact: {
        lead: 'Una domanda, un progetto, una richiesta di valutazione? Scriveteci.',
        detailsTitle: 'Recapiti',
        formTitle: 'Modulo di contatto',
        websiteLabel: 'Sito',
        emailLabel: 'Contatto istituzionale',
        founderLabel: 'Fondatore e Presidente',
        email: 'infos@mhsv.ch',
        founderEmail: 'm.happi@mhsv.ch',
      },
    },
    bookOrder: {
      title: 'Richiesta di ordine',
      intro: 'Si tratta di una richiesta di ordine, non di un pagamento. MHSV® vi contatterà per confermare le modalità.',
      edition: 'Edizione',
      editionFr: 'Francese',
      editionEn: 'Inglese',
      quantity: 'Quantità',
      organisation: 'Organizzazione',
      country: 'Paese',
      consent: 'Accetto che MHSV® utilizzi i miei dati per trattare la mia richiesta di ordine.',
      submit: 'Invia la richiesta',
      successTitle: 'Richiesta ricevuta',
      successBody: 'La vostra richiesta è stata trasmessa. MHSV® vi contatterà per confermare disponibilità, prezzo, consegna e modalità di pagamento.',
      errors: {
        edition: 'Scegliete un’edizione.',
        quantity: 'Indicate una quantità valida.',
        organisation: 'Indicate la vostra organizzazione.',
        country: 'Indicate il vostro paese.',
        consent: 'Il vostro consenso è necessario per inviare la richiesta.',
      },
    },
    newsletterForm: {
      firstName: 'Nome',
      email: 'E-mail',
      language: 'Lingua preferita',
      consent: 'Accetto di ricevere la newsletter MHSV® e posso disiscrivermi in qualsiasi momento.',
      submit: 'Iscrivimi',
      successTitle: 'Ci siamo quasi',
      successBody: 'Grazie. Un’e-mail di conferma è in arrivo - cliccate sul link che contiene per completare l’iscrizione.',
      errors: {
        email: 'Indicate un indirizzo e-mail valido.',
        language: 'Scegliete una lingua.',
        consent: 'Il vostro consenso è necessario per iscrivervi.',
      },
      privacyNote: 'I vostri dati sono utilizzati unicamente per l’invio della newsletter. Ogni messaggio contiene un link di disiscrizione.',
    },
    footer: {
      navTitle: 'Sezioni',
      legalTitle: 'Informazioni',
      summary: 'MHSV® - Centro Internazionale di Sviluppo e Transizione | Ginevra - Svizzera | www.mhsv.ch | infos@mhsv.ch',
    },
  },
};

function deepMerge(base, patch) {
  if (Array.isArray(patch) || patch === null || typeof patch !== 'object') return patch;
  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(out[k], v);
  return out;
}

for (const [loc, patch] of Object.entries(PATCH)) {
  const file = resolve(ROOT, `src/content/authored/${loc}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));

  const merged = deepMerge(json, patch);

  // Governance replaces the pack's five people wholesale.
  merged.sections.team.members = GOVERNANCE[loc].map(([name, role, email]) => ({
    name,
    role,
    email,
    emailPending: false,
  }));

  // The pack's §21 contact tagline and place stay; the addresses are superseded.
  writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
  console.log(`  ✓ src/content/authored/${loc}.json  - governance (6), book, newsletter, contact`);
}
