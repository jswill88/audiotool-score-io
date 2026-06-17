# Oracle A1 Capacity Hunter

This folder contains a local helper for repeatedly trying to create an Oracle Cloud Always Free `VM.Standard.A1.Flex` instance for the production deployment.

Use it from your local machine, not from the tiny E2 micro VM.

## Prerequisites

Install and configure the OCI CLI:

```bash
brew install oci-cli
oci setup config
```

The configured OCI user needs permission to launch compute instances in the target compartment and subnet.

## Configure

Copy the example env file:

```bash
cp scripts/oracle/a1-capacity-hunter.env.example scripts/oracle/a1-capacity-hunter.env
```

Edit `scripts/oracle/a1-capacity-hunter.env` and fill in:

- `OCI_TENANCY_ID`
- `OCI_COMPARTMENT_ID`
- `OCI_SUBNET_ID`
- `OCI_IMAGE_ID`
- `OCI_SSH_PUBLIC_KEY_FILE`

If you have the Oracle private key but not the matching `.pub` file, regenerate the public key locally:

```bash
ssh-keygen -y -f ~/.ssh/oracle_audiotool_score_io.key > ~/.ssh/oracle_audiotool_score_io.pub
chmod 644 ~/.ssh/oracle_audiotool_score_io.pub
```

`OCI_IMAGE_ID` must be an ARM/aarch64 image that supports `VM.Standard.A1.Flex` in the selected region.

Start with:

```text
OCI_OCPUS=1
OCI_MEMORY_GBS=6
OCI_BOOT_VOLUME_GBS=50
```

That is already far stronger than the current E2 micro VM.

## Run

Do a dry run first:

```bash
OCI_DRY_RUN=true scripts/oracle/a1-capacity-hunter.sh
```

Then run for real:

```bash
scripts/oracle/a1-capacity-hunter.sh
```

By default it tries every availability domain, sleeps for 30 minutes, and repeats until it creates an instance. Logs are written to:

```text
tmp/oracle/a1-capacity-hunter.log
```

Stop the script with `Ctrl+C`.

## Run On macOS With LaunchAgent

For a long-running local hunt, install the script outside `Documents` so macOS privacy controls do not block `launchd`:

```bash
scripts/oracle/install-a1-capacity-hunter-launchd.sh
```

The installer copies the helper to:

```text
~/.local/bin/a1-capacity-hunter.sh
```

And it copies the local config to:

```text
~/.config/audiotool-score-io/a1-capacity-hunter.env
```

The LaunchAgent label used for this project is:

```text
com.audiotool-score-io.a1-capacity-hunter
```

Check the running job:

```bash
launchctl print gui/$(id -u)/com.audiotool-score-io.a1-capacity-hunter
tail -f ~/Library/Logs/audiotool-score-io/a1-capacity-hunter.log
```

Stop it after Oracle creates the A1 instance:

```bash
launchctl bootout gui/$(id -u)/com.audiotool-score-io.a1-capacity-hunter
```

## After Success

When the script creates an instance:

1. SSH into the new VM.
2. Install Docker, Docker Compose, Git, and Caddy.
3. Clone this repo and copy the production `.env` values.
4. Run `docker compose up -d --build`.
5. Point DuckDNS at the new public IP.
6. Verify `https://audiotool-score-io.duckdns.org/health` and `/ready`.
7. Terminate the old E2 micro VM only after the new VM works.
