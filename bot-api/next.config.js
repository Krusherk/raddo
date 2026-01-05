/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['ethers']
    }
};

module.exports = nextConfig;
