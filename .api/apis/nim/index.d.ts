import type * as types from './types';
import type { ConfigOptions, FetchResponse } from 'api/dist/core';
import Oas from 'oas';
import APICore from 'api/dist/core';
declare class SDK {
    spec: Oas;
    core: APICore;
    constructor();
    /**
     * Optionally configure various options that the SDK allows.
     *
     * @param config Object of supported SDK options and toggles.
     * @param config.timeout Override the default `fetch` request timeout of 30 seconds. This number
     * should be represented in milliseconds.
     */
    config(config: ConfigOptions): void;
    /**
     * If the API you're using requires authentication you can supply the required credentials
     * through this method and the library will magically determine how they should be used
     * within your API request.
     *
     * With the exception of OpenID and MutualTLS, it supports all forms of authentication
     * supported by the OpenAPI specification.
     *
     * @example <caption>HTTP Basic auth</caption>
     * sdk.auth('username', 'password');
     *
     * @example <caption>Bearer tokens (HTTP or OAuth 2)</caption>
     * sdk.auth('myBearerToken');
     *
     * @example <caption>API Keys</caption>
     * sdk.auth('myApiKey');
     *
     * @see {@link https://spec.openapis.org/oas/v3.0.3#fixed-fields-22}
     * @see {@link https://spec.openapis.org/oas/v3.1.0#fixed-fields-22}
     * @param values Your auth credentials for the API; can specify up to two strings or numbers.
     */
    auth(...values: string[] | number[]): this;
    /**
     * If the API you're using offers alternate server URLs, and server variables, you can tell
     * the SDK which one to use with this method. To use it you can supply either one of the
     * server URLs that are contained within the OpenAPI definition (along with any server
     * variables), or you can pass it a fully qualified URL to use (that may or may not exist
     * within the OpenAPI definition).
     *
     * @example <caption>Server URL with server variables</caption>
     * sdk.server('https://{region}.api.example.com/{basePath}', {
     *   name: 'eu',
     *   basePath: 'v14',
     * });
     *
     * @example <caption>Fully qualified server URL</caption>
     * sdk.server('https://eu.api.example.com/v14');
     *
     * @param url Server URL
     * @param variables An object of variables to replace into the server URL.
     */
    server(url: string, variables?: {}): void;
    /**
     * Note: This is for managed service. Takes all the data and options at once, solves the
     * routing problem and returns result.  This POST should be used in conjunction with the
     * NVCF API which allows for the upload of large assets.
     * You can find details on how to use NVCF Asset APIs here:
     * https://docs.api.nvidia.com/cloud-functions/reference/createasset
     *
     * @summary Submit to solver
     * @throws FetchError<400, types.NvidiaCuoptInferResponse400> Value Error Or Validation Error
     * @throws FetchError<409, types.NvidiaCuoptInferResponse409> Failed to get route
     * @throws FetchError<422, types.NvidiaCuoptInferResponse422> Unprocessable Entity or Runtime Error or Out of memory error
     * @throws FetchError<500, types.NvidiaCuoptInferResponse500> Any uncaught cuOpt error or Server errors
     */
    nvidiaCuoptInfer(body: types.NvidiaCuoptInferBodyParam, metadata?: types.NvidiaCuoptInferMetadataParam): Promise<FetchResponse<200, types.NvidiaCuoptInferResponse200> | FetchResponse<202, types.NvidiaCuoptInferResponse202>>;
    /**
     * Gets the result of an earlier function invocation request that returned a status of 202.
     *
     * @summary Status polling
     * @throws FetchError<422, types.NvidiaCuoptStatuspollingResponse422> The invocation ended with an error.
     * @throws FetchError<500, types.NvidiaCuoptStatuspollingResponse500> The invocation ended with an error.
     */
    nvidiaCuoptStatuspolling(metadata: types.NvidiaCuoptStatuspollingMetadataParam): Promise<FetchResponse<200, types.NvidiaCuoptStatuspollingResponse200> | FetchResponse<202, types.NvidiaCuoptStatuspollingResponse202>>;
}
declare const createSDK: SDK;
export default createSDK;