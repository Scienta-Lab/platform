export const toolNames = {
  _immunatlas_get_metadata: "Get ImmunAtlas Metadata",
  _immunatlas_get_length: "Get ImmunAtlas Length",
  _immunatlas_get_genes_present: "ImmunAtlas Genes Present",
  _immunatlas_get_first_genes: "Get ImmunAtlas First Genes",
  _immunatlas_get_obs_values: "Get ImmunAtlas Obs Values",
  _immunatlas_generate_figure_from_dataset:
    "Generate Figure from ImmunAtlas Dataset",
  _immunatlas_generate_statistics_from_dataset:
    "Generate Statistics from ImmunAtlas Dataset",
  _precisesads_get_metadata: "Get PreciseSADS Metadata",
  _precisesads_get_length: "Get PreciseSADS Length",
  _precisesads_get_genes_present: "PreciseSADS Genes Present",
  _precisesads_get_first_genes: "Get PreciseSADS First Genes",
  _precisesads_get_obs_values: "Get PreciseSADS Obs Values",
  _precisesads_generate_figure_from_dataset:
    "Generate Figure from PreciseSADS Dataset",
  _precisesads_generate_statistics_from_dataset:
    "Generate Statistics from PreciseSADS Dataset",
  "_enigma_enigma-network_generate_network": "Generate Enigma Network",
  "_enigma_gene-annotations_retrieve_gene_annotations":
    "Retrieve Gene Annotations",
  "_enigma_gene-annotations_retrieve_go_biological_processes":
    "Retrieve GO Biological Processes",
  biomcp_article_details: "Article Details",
  biomcp_article_searcher: "Article Search",
  biomcp_trial_protocol: "Trial Protocol",
  biomcp_trial_locations: "Trial Locations",
  biomcp_trial_outcomes: "Trial Outcomes",
  biomcp_trial_references: "Trial References",
  biomcp_trial_searcher: "Trial Search",
} as const;

export type ToolName = keyof typeof toolNames;

export const toolTags = ["image", "thinking"] as const;
export type ToolTag = (typeof toolTags)[number];

export const isToolTag = (tag: string): tag is ToolTag =>
  toolTags.includes(tag as ToolTag);
