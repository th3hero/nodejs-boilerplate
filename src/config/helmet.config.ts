import { HelmetOptions } from 'helmet';

/**
 * Helmet configuration for securing HTTP headers.
 * Each setting is documented below for clarity and maintainability.
 */
const helmetConfiguration: HelmetOptions = {
    /**
     * Content Security Policy (CSP) helps prevent XSS attacks by restricting the sources of content.
     * - defaultSrc: Only allow content from the same origin.
     * - scriptSrc: Only allow scripts from the same origin.
     * - styleSrc: Allow styles from the same origin and inline styles (unsafe-inline).
     * - imgSrc: Allow images from the same origin, data URIs, and HTTPS sources.
     * - connectSrc: Only allow connections (e.g., XHR, WebSocket) to the same origin.
     * - objectSrc: Disallow all <object>, <embed>, and <applet> elements.
     * - frameSrc: Disallow embedding the site in frames/iframes.
     */
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"], // Only allow resources from the same origin
            scriptSrc: ["'self'"], // Only allow scripts from the same origin
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow styles from same origin and inline styles
            imgSrc: ["'self'", 'data:', 'https:'], // Allow images from same origin, data URIs, and HTTPS
            connectSrc: ["'self'"], // Only allow connections to the same origin
            objectSrc: ["'none'"], // Disallow all object, embed, and applet elements
            frameSrc: ["'none'"] // Disallow all framing of the site
        }
    },

    /**
     * Frameguard helps prevent clickjacking attacks by controlling whether the site can be framed.
     * - action: "deny" completely disallows framing.
     */
    frameguard: { action: 'deny' },

    /**
     * HidePoweredBy removes the X-Powered-By header to make it harder for attackers to see what technology is used.
     */
    hidePoweredBy: true,

    /**
     * noSniff sets the X-Content-Type-Options header to "nosniff" to prevent browsers from MIME-sniffing a response away from the declared content-type.
     */
    noSniff: true,

    /**
     * HSTS (HTTP Strict Transport Security) enforces secure (HTTPS) connections to the server.
     * - maxAge: Time in seconds that the browser should remember to only access the site via HTTPS (1 year here).
     * - includeSubDomains: Apply HSTS to all subdomains.
     * - preload: Allow the site to be included in browsers' HSTS preload list.
     */
    hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true
    }
};

export default helmetConfiguration;
