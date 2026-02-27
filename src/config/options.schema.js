const { z } = require('zod');
const fs = require('fs');
const constants = require('./constants');

const CliOptionsSchema = z.object({
    sku: z.string().optional(),
    csv: z.string().optional(),
    validate: z.boolean().default(false),
    output: z.string().default(constants.QR_OUTPUT_DIR),
    format: z.enum(['png', 'svg']).default(constants.QR_DEFAULT_FORMAT),
    concurrency: z.number().int().positive().default(constants.QR_CONCURRENCY),
    logo: z.string().optional(),
    summaryFormat: z.enum(['csv', 'json']).default('csv')
}).refine(data => {
    return (data.sku && !data.csv) || (!data.sku && data.csv);
}, {
    message: "Provide either --sku or --csv, but not both"
}).superRefine((val, ctx) => {
    if (val.csv) {
        if (!fs.existsSync(val.csv)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `CSV file not found: ${val.csv}`,
                path: ['csv']
            });
        }
    }
    if (val.logo) {
        if (!fs.existsSync(val.logo)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Logo file not found: ${val.logo}`,
                path: ['logo']
            });
        }
    }
    if (val.format === 'svg' && val.logo) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Logo insertion is currently only supported for PNG format.",
            path: ['logo']
        });
    }
});

/**
 * Validates parsed CLI options.
 * 
 * @param {object} options 
 * @returns {object} validated options
 */
function validateOptions(options) {
    try {
        return CliOptionsSchema.parse(options);
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error("\n❌ Configuration Error:");
            err.errors.forEach(e => console.error(`  - ${e.message}`));
            process.exit(1);
        }
        throw err;
    }
}

module.exports = {
    validateOptions
};
