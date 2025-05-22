export const toolNames = {
  enigma_generate_network: "Gene Association Network",
  biomcp_article_details: "Article Details",
  biomcp_article_searcher: "Article Search",
  biomcp_trial_protocol: "Trial Protocol",
  biomcp_trial_locations: "Trial Locations",
  biomcp_trial_outcomes: "Trial Outcomes",
  biomcp_trial_references: "Trial References",
  biomcp_trial_searcher: "Trial Search",
  biomcp_variant_details: "Variant Details",
  biomcp_variant_searcher: "Variant Search",
  "data-analysis_get_immunatlas_metadata": "Get ImmunAtlas Metadata",
  "data-analysis_get_immunatlas_vars": "Get ImmunAtlas Variables",
  "data-analysis_get_immunatlas_length": "Get ImmunAtlas Length",
  "data-analysis_immunatlas_genes_present": "ImmunAtlas Genes Present",
  "data-analysis_get_immunatlas_first_genes": "Get ImmunAtlas First Genes",
  "data-analysis_get_immunatlas_values_for_obs":
    "Get ImmunAtlas Values for Obs",
  "data-analysis_generate_figure_from_dataset": "Generate Figure from Dataset",
  "data-analysis_generate_statistics_from_dataset":
    "Generate Statistics from Dataset",
} as const;

export type ToolName = keyof typeof toolNames;

export const isThinkingTool = (
  name: ToolName,
): name is
  | "data-analysis_get_immunatlas_metadata"
  | "data-analysis_get_immunatlas_vars"
  | "data-analysis_get_immunatlas_length"
  | "data-analysis_immunatlas_genes_present"
  | "data-analysis_get_immunatlas_first_genes"
  | "data-analysis_get_immunatlas_values_for_obs" => {
  return [
    "data-analysis_get_immunatlas_metadata",
    "data-analysis_get_immunatlas_vars",
    "data-analysis_get_immunatlas_length",
    "data-analysis_immunatlas_genes_present",
    "data-analysis_get_immunatlas_first_genes",
    "data-analysis_get_immunatlas_values_for_obs",
  ].includes(name);
};
