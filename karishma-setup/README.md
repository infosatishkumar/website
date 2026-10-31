# Karishma (OpenJarvis setup kit)

Sets up OpenJarvis as **Karishma**, a female assistant that speaks with the ElevenLabs voice **Monika Sogam** (`2zRM7PkgwBPiau2jvVXc`).

Run it on your Mac:

```bash
cd ~/Desktop && git clone -b claude/optimistic-curie-x25r0u https://github.com/infosatishkumar/website.git karishma-kit && ./karishma-kit/karishma-setup/install-karishma.sh
```

What the script does: it installs Ollama and OpenJarvis, clones OpenJarvis to `~/Desktop/OpenJarvis`, sets Karishma's system prompt, and switches TTS to ElevenLabs with the Monika Sogam voice. It asks for your ElevenLabs API key and saves it in your shell rc. It backs up your config before changing it.
