import type { FromSchema } from 'json-schema-to-ts';
import * as schemas from './schemas';
export type NvidiaCuoptInferBodyParam = FromSchema<typeof schemas.NvidiaCuoptInfer.body>;
export type NvidiaCuoptInferMetadataParam = FromSchema<typeof schemas.NvidiaCuoptInfer.metadata>;
export type NvidiaCuoptInferResponse200 = FromSchema<typeof schemas.NvidiaCuoptInfer.response['200']>;
export type NvidiaCuoptInferResponse202 = FromSchema<typeof schemas.NvidiaCuoptInfer.response['202']>;
export type NvidiaCuoptInferResponse400 = FromSchema<typeof schemas.NvidiaCuoptInfer.response['400']>;
export type NvidiaCuoptInferResponse409 = FromSchema<typeof schemas.NvidiaCuoptInfer.response['409']>;
export type NvidiaCuoptInferResponse422 = FromSchema<typeof schemas.NvidiaCuoptInfer.response['422']>;
export type NvidiaCuoptInferResponse500 = FromSchema<typeof schemas.NvidiaCuoptInfer.response['500']>;
export type NvidiaCuoptStatuspollingMetadataParam = FromSchema<typeof schemas.NvidiaCuoptStatuspolling.metadata>;
export type NvidiaCuoptStatuspollingResponse200 = FromSchema<typeof schemas.NvidiaCuoptStatuspolling.response['200']>;
export type NvidiaCuoptStatuspollingResponse202 = FromSchema<typeof schemas.NvidiaCuoptStatuspolling.response['202']>;
export type NvidiaCuoptStatuspollingResponse422 = FromSchema<typeof schemas.NvidiaCuoptStatuspolling.response['422']>;
export type NvidiaCuoptStatuspollingResponse500 = FromSchema<typeof schemas.NvidiaCuoptStatuspolling.response['500']>;
