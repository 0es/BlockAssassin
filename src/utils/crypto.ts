/**
 * Encryption utility class for client-side
 *
 * Provides hybrid encryption (RSA+AES) for secure communication with the server.
 * This implementation is compatible with the server-side encryption.
 */
import { decodeBase64, encodeBase64 } from "@std/encoding";
import { logger } from "./logger.ts";

/**
 * Supported encryption algorithms
 */
export enum EncryptionAlgorithm {
    RSA = "RSA", // RSA+AES hybrid
    NONE = "NONE", // No encryption, only for development environments
}

/**
 * RSA key pair management class
 */
export class RsaKeyManager {
    private static instance: RsaKeyManager;
    private serverPublicKey: CryptoKey | null = null;
    private clientPrivateKey: CryptoKey | null = null;
    private serverPublicKeyPem: string | null = null;
    private clientPrivateKeyPem: string | null = null;
    private initialized = false;

    private constructor() {}

    /**
     * Get singleton instance
     */
    public static getInstance(): RsaKeyManager {
        if (!RsaKeyManager.instance) {
            RsaKeyManager.instance = new RsaKeyManager();
        }
        return RsaKeyManager.instance;
    }

    /**
     * Read PEM content from file
     */
    private async readPemFile(filePath: string): Promise<string> {
        try {
            const fileContent = await Deno.readTextFile(filePath);
            return fileContent.trim();
        } catch (error) {
            logger.error(`Failed to read PEM file: ${filePath}`, error as Error);
            throw new Error(`Failed to read PEM file: ${filePath}`);
        }
    }

    /**
     * Initialize RSA key manager
     */
    public async initialize(serverPublicKeyPath?: string, clientPrivateKeyPath?: string): Promise<void> {
        if (this.initialized) return;

        try {
            // Read keys from files if paths are provided
            if (serverPublicKeyPath) {
                logger.info(`Reading server RSA public key from file: ${serverPublicKeyPath}`);
                const pubKeyPem = await this.readPemFile(serverPublicKeyPath);
                this.serverPublicKeyPem = pubKeyPem;
                this.serverPublicKey = await this.importPublicKey(pubKeyPem);
            }

            if (clientPrivateKeyPath) {
                logger.info(`Reading client RSA private key from file: ${clientPrivateKeyPath}`);
                const privKeyPem = await this.readPemFile(clientPrivateKeyPath);
                this.clientPrivateKeyPem = privKeyPem;
                this.clientPrivateKey = await this.importPrivateKey(privKeyPem);
            }

            this.initialized = true;
            if (this.serverPublicKey || this.clientPrivateKey) {
                logger.info("RSA key manager initialized successfully with provided keys");
            } else {
                logger.info("No RSA keys provided for initialization");
            }
        } catch (error) {
            logger.error("RSA key manager initialization failed", error as Error);
            throw error;
        }
    }

    /**
     * Import public key from PEM format
     */
    private async importPublicKey(pemKey: string): Promise<CryptoKey> {
        try {
            // Remove header, footer, and newlines
            const pemContents = pemKey
                .replace(/-+BEGIN PUBLIC KEY-+/, "")
                .replace(/-+END PUBLIC KEY-+/, "")
                .replace(/\s/g, "");

            // Decode base64
            const binaryDer = decodeBase64(pemContents);

            // Import key
            return await crypto.subtle.importKey(
                "spki",
                binaryDer,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256",
                },
                true,
                ["encrypt"],
            );
        } catch (error) {
            logger.error("Failed to import RSA public key", error as Error);
            throw error;
        }
    }

    /**
     * Import private key from PEM format
     */
    private async importPrivateKey(pemKey: string): Promise<CryptoKey> {
        try {
            // Remove header, footer, and newlines
            const pemContents = pemKey
                .replace(/-+BEGIN PRIVATE KEY-+/, "")
                .replace(/-+END PRIVATE KEY-+/, "")
                .replace(/\s/g, "");

            // Decode base64
            const binaryDer = decodeBase64(pemContents);

            // Import key
            return await crypto.subtle.importKey(
                "pkcs8",
                binaryDer,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256",
                },
                true,
                ["decrypt"],
            );
        } catch (error) {
            logger.error("Failed to import RSA private key", error as Error);
            throw error;
        }
    }

    /**
     * Get server public key
     */
    public async getServerPublicKey(): Promise<CryptoKey> {
        if (!this.initialized) {
            throw new Error("RSA key manager not initialized");
        }
        if (!this.serverPublicKey) {
            throw new Error("Server public key not available");
        }
        return this.serverPublicKey;
    }

    /**
     * Get client private key
     */
    public async getClientPrivateKey(): Promise<CryptoKey> {
        if (!this.initialized) {
            throw new Error("RSA key manager not initialized");
        }
        if (!this.clientPrivateKey) {
            throw new Error("Client private key not available");
        }
        return this.clientPrivateKey;
    }
}

/**
 * Message Encryptor for client
 *
 * This class handles the hybrid encryption/decryption process:
 * - For sending messages to server: AES key is generated, used to encrypt the message,
 *   then the AES key is encrypted with the server's public key
 * - For receiving messages from server: The encrypted AES key is decrypted with the client's
 *   private key, then used to decrypt the message
 */
export class ClientMessageEncryptor {
    private algorithm: EncryptionAlgorithm;
    private keyManager: RsaKeyManager | null = null;
    private serverPublicKey: CryptoKey | null = null;
    private clientPrivateKey: CryptoKey | null = null;

    /**
     * Constructor
     */
    constructor(algorithm: string, serverPublicKeyPath?: string, clientPrivateKeyPath?: string) {
        // Parse algorithm
        if (algorithm === "RSA") {
            this.algorithm = EncryptionAlgorithm.RSA;
        } else if (algorithm === "NONE") {
            this.algorithm = EncryptionAlgorithm.NONE;
            logger.warn("Using no encryption (NONE) - This should only be used for development!");
        } else {
            logger.error(`Unsupported encryption algorithm: ${algorithm}, defaulting to RSA`);
            this.algorithm = EncryptionAlgorithm.RSA;
        }

        // Initialize RSA keys if using RSA algorithm
        if (this.algorithm === EncryptionAlgorithm.RSA) {
            this.initializeRsaKeys(serverPublicKeyPath, clientPrivateKeyPath);
        }
    }

    /**
     * Initialize RSA keys
     */
    private async initializeRsaKeys(serverPublicKeyPath?: string, clientPrivateKeyPath?: string): Promise<void> {
        try {
            // Get RSA key manager instance
            const keyManager = RsaKeyManager.getInstance();
            await keyManager.initialize(serverPublicKeyPath, clientPrivateKeyPath);
            this.keyManager = keyManager;

            // Load keys if available
            try {
                this.serverPublicKey = await keyManager.getServerPublicKey();
                logger.info("Server public key loaded successfully");
            } catch (error) {
                logger.warn("Server public key not available, encryption may not work");
            }

            try {
                this.clientPrivateKey = await keyManager.getClientPrivateKey();
                logger.info("Client private key loaded successfully");
            } catch (error) {
                logger.warn("Client private key not available, decryption may not work");
            }
        } catch (error) {
            logger.error("Failed to initialize RSA keys", error as Error);
            throw error;
        }
    }

    /**
     * Encrypt message using the specified algorithm
     */
    public async encrypt(message: string): Promise<string> {
        if (this.algorithm === EncryptionAlgorithm.NONE) {
            // No encryption, just return the message
            return message;
        } else if (this.algorithm === EncryptionAlgorithm.RSA) {
            // Make sure server public key is available
            if (!this.serverPublicKey) {
                throw new Error("Server public key not available for encryption");
            }

            // Convert message to Uint8Array
            const encoder = new TextEncoder();
            const messageBytes = encoder.encode(message);

            // Use hybrid encryption
            return await this.encryptHybrid(messageBytes);
        } else {
            throw new Error(`Unsupported encryption algorithm: ${this.algorithm}`);
        }
    }

    /**
     * Decrypt message using the specified algorithm
     */
    public async decrypt(encryptedMessage: string): Promise<string> {
        if (this.algorithm === EncryptionAlgorithm.NONE) {
            // No encryption, just return the message
            return encryptedMessage;
        } else if (this.algorithm === EncryptionAlgorithm.RSA) {
            // Make sure client private key is available
            if (!this.clientPrivateKey) {
                throw new Error("Client private key not available for decryption");
            }

            // Use hybrid decryption
            return await this.decryptHybrid(encryptedMessage);
        } else {
            throw new Error(`Unsupported encryption algorithm: ${this.algorithm}`);
        }
    }

    /**
     * Encrypt AES key with RSA
     */
    private async encryptAesKeyWithRsa(aesKey: Uint8Array): Promise<string> {
        try {
            // Encrypt the AES key with the server's RSA public key
            const encryptedKey = await crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP",
                },
                this.serverPublicKey!,
                aesKey,
            );

            // Convert to Base64
            return encodeBase64(new Uint8Array(encryptedKey));
        } catch (error) {
            logger.error("Failed to encrypt AES key with RSA", error as Error);
            throw error;
        }
    }

    /**
     * Decrypt AES key with RSA
     */
    private async decryptAesKeyWithRsa(encryptedKeyBase64: string): Promise<Uint8Array> {
        try {
            // Decode Base64
            const encryptedKey = decodeBase64(encryptedKeyBase64);

            // Decrypt the AES key with the client's RSA private key
            const decryptedKey = await crypto.subtle.decrypt(
                {
                    name: "RSA-OAEP",
                },
                this.clientPrivateKey!,
                encryptedKey,
            );

            return new Uint8Array(decryptedKey);
        } catch (error) {
            logger.error("Failed to decrypt AES key with RSA", error as Error);
            throw error;
        }
    }

    /**
     * Generate random AES key and IV
     */
    private async generateRandomAesKey(): Promise<{ key: Uint8Array; iv: Uint8Array }> {
        // Generate random AES key (256 bits = 32 bytes)
        const key = crypto.getRandomValues(new Uint8Array(32));

        // Generate random initialization vector (IV) for AES-CBC (128 bits = 16 bytes)
        const iv = crypto.getRandomValues(new Uint8Array(16));

        return { key, iv };
    }

    /**
     * Encrypt data with AES
     */
    private async encryptWithAes(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
        try {
            // Import the raw AES key
            const cryptoKey = await crypto.subtle.importKey(
                "raw",
                key,
                {
                    name: "AES-CBC",
                    length: 256,
                },
                false,
                ["encrypt"],
            );

            // Encrypt the data
            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: "AES-CBC",
                    iv,
                },
                cryptoKey,
                data,
            );

            return new Uint8Array(encryptedData);
        } catch (error) {
            logger.error("Failed to encrypt with AES", error as Error);
            throw error;
        }
    }

    /**
     * Decrypt data with AES
     */
    private async decryptWithAes(encryptedData: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
        try {
            // Import the raw AES key
            const cryptoKey = await crypto.subtle.importKey(
                "raw",
                key,
                {
                    name: "AES-CBC",
                    length: 256,
                },
                false,
                ["decrypt"],
            );

            // Decrypt the data
            const decryptedData = await crypto.subtle.decrypt(
                {
                    name: "AES-CBC",
                    iv,
                },
                cryptoKey,
                encryptedData,
            );

            return new Uint8Array(decryptedData);
        } catch (error) {
            logger.error("Failed to decrypt with AES", error as Error);
            throw error;
        }
    }

    /**
     * Hybrid encryption (RSA+AES)
     */
    private async encryptHybrid(data: Uint8Array): Promise<string> {
        try {
            // Generate random AES key and IV
            const { key, iv } = await this.generateRandomAesKey();

            // Encrypt the data with AES
            const encryptedData = await this.encryptWithAes(data, key, iv);

            // Encrypt the AES key with RSA
            const encryptedKey = await this.encryptAesKeyWithRsa(key);

            // Create the encrypted message object
            const encryptedMessage = {
                k: encryptedKey, // Encrypted AES key
                i: encodeBase64(iv), // Initialization vector
                d: encodeBase64(encryptedData), // Encrypted data
            };

            // Convert to JSON string
            return JSON.stringify(encryptedMessage);
        } catch (error) {
            logger.error("Hybrid encryption failed", error as Error);
            throw error;
        }
    }

    /**
     * Hybrid decryption (RSA+AES)
     */
    private async decryptHybrid(encryptedMessage: string): Promise<string> {
        try {
            // Parse the encrypted message
            const parsedMessage = JSON.parse(encryptedMessage);

            // Check required fields
            if (!parsedMessage.k || !parsedMessage.i || !parsedMessage.d) {
                throw new Error("Invalid encrypted message format, missing required fields");
            }

            // Extract components
            const encryptedKey = parsedMessage.k;
            const iv = decodeBase64(parsedMessage.i);
            const encryptedData = decodeBase64(parsedMessage.d);

            // Decrypt the AES key with RSA
            const aesKey = await this.decryptAesKeyWithRsa(encryptedKey);

            // Decrypt the data with AES
            const decryptedData = await this.decryptWithAes(encryptedData, aesKey, iv);

            // Convert to string
            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            logger.error("Hybrid decryption failed", error as Error);
            throw error;
        }
    }
}
