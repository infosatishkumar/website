export const siteUrl = "https://satishkumar.net";

// Public profiles that describe the same person. Google uses these
// `sameAs` links to tie every profile to one entity (Knowledge Panel).
// Only list profile pages here, not individual articles or answers.
export const profiles = [
  "https://www.instagram.com/infosatishkumar/",
  "https://www.facebook.com/infosatishkumar/",
  "https://www.linkedin.com/in/infosatishkumar/",
  "https://www.youtube.com/@infosatishkumar",
  "https://x.com/infosatishkumar",
  "https://www.threads.com/@infosatishkumar",
  "https://www.behance.net/infosatishkumar",
  "https://in.pinterest.com/infosatishkumar/",
  "https://medium.com/@infosatish.in",
  "https://www.quora.com/profile/Satish-Kumar-35240",
  "https://about.me/satishkumar.net",
  "https://github.com/infosatishkumar",
  "https://www.wikidata.org/wiki/Q138779473",
];

export const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${siteUrl}/#satishkumar`,
  name: "Satish Kumar",
  url: siteUrl,
  // TODO: add a clear headshot at public/satish-kumar.jpg, then uncomment.
  // image: `${siteUrl}/satish-kumar.jpg`,
  jobTitle: "Creative Motion Graphic Designer",
  description:
    "Satish Kumar is a creative motion graphic designer, animator, website developer and published author based in Bengaluru, India.",
  birthDate: "1996-05-18",
  nationality: { "@type": "Country", name: "India" },
  homeLocation: {
    "@type": "Place",
    name: "Bengaluru, Karnataka, India",
  },
  knowsAbout: [
    "Motion graphics",
    "Animation",
    "Graphic design",
    "Branding",
    "Web design",
    "Social media management",
  ],
  hasOccupation: [
    { "@type": "Occupation", name: "Motion Graphic Designer" },
    { "@type": "Occupation", name: "Author" },
  ],
  sameAs: profiles,
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  url: siteUrl,
  name: "Satish Kumar",
  publisher: { "@id": `${siteUrl}/#satishkumar` },
};

export function jsonLdScript(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
