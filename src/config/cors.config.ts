import { CorsOptions } from 'cors';
import environment from './environment.config';

/**
 * CORS (Cross-Origin Resource Sharing) configuration.
 * This configuration controls how the server responds to cross-origin requests.
 * Each option is documented below for clarity and maintainability.
 */
const corsConfiguration: CorsOptions = {
    /**
     * Specifies the origins allowed to access the server.
     * - Sourced from environment configuration (array of allowed origins).
     * - Example: ["https://example.com", "http://localhost:3000"]
     */
    origin: environment.cors?.origin,

    /**
     * Specifies the HTTP methods allowed for CORS requests.
     * - Sourced from environment configuration (array of allowed methods).
     * - Example: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
     */
    methods: environment.cors?.methods,

    /**
     * Specifies the headers allowed in the actual request.
     * - Allows common browser headers and custom headers.
     */
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Referer',
        'User-Agent',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'DNT'
    ],

    /**
     * Indicates whether the response to the request can be exposed when credentials are present.
     * - true: Allows cookies and credentials to be sent in cross-origin requests.
     */
    credentials: true,

    /**
     * Indicates how long (in seconds) the results of a preflight request can be cached.
     * - Sourced from environment configuration.
     * - Example: 86400 (24 hours)
     */
    maxAge: environment.cors?.maxAge,

    /**
     * Pass the CORS preflight response to the next handler.
     * - false: The response will be sent immediately.
     */
    preflightContinue: false,

    /**
     * The status code sent for successful OPTIONS requests.
     * - 204: No Content
     */
    optionsSuccessStatus: 204,

    /**
     * Specifies the headers that are exposed to the browser.
     */
    exposedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
};

export default corsConfiguration;
