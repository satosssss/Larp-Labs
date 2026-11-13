export function preparationGroups(en: boolean) {
  return [
    {
      title: en ? "Who to contact" : "Sino ang kakausapin",
      items: [
        [
          "contact",
          en
            ? "Identify a legal help provider to ask about your notice."
            : "Humanap ng abogado o legal aid office.",
        ],
      ],
    },
    {
      title: en ? "What to prepare" : "Ano ang ihahanda",
      items: [
        [
          "notice",
          en
            ? "The complete notice and its envelope, if available."
            : "Ang buong notice at sobre nito, kung mayroon.",
        ],
        [
          "id",
          en
            ? "An identification document, if requested by the provider."
            : "ID, kung hihingin ng opisina.",
        ],
        [
          "related",
          en
            ? "Any related documents and your notes."
            : "Iba pang dokumento at notes tungkol dito.",
        ],
      ],
    },
    {
      title: en ? "What to clarify" : "Ano ang lilinawin",
      items: [
        [
          "schedule",
          en
            ? "Ask about the stated schedule and any applicable deadlines."
            : "Itanong kung may deadline at kailan ito.",
        ],
        [
          "cost",
          en
            ? "Ask about eligibility, appointment requirements, and any costs."
            : "Itanong ang requirements, schedule, at kung may bayad.",
        ],
      ],
    },
  ];
}
