#!/usr/bin/env python3
"""Aponta o storage do Supabase para o R2 quando as chaves existem.

Arquivo que precisa ficar guardado (foto, vídeo, áudio, logo) não mora no
disco da VPS. Se o container voltar com STORAGE_BACKEND=file — um `supabase
start` faz isso — este script recria só o container de storage, com o mesmo
nome, e lê as credenciais do .env. Não imprime segredo.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ENV_PATH = Path("/opt/moopecrm/.env")
CONTAINER = "supabase_storage_deskcomm-crm"
NETWORK = "supabase_network_deskcomm-crm"


def ler_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        out[key] = value.strip().strip('"').strip("'")
    return out


def sh(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, capture_output=True, text=True)


def main() -> int:
    if not ENV_PATH.exists():
        print("sem .env, storage não foi alterado")
        return 0
    envfile = ler_env(ENV_PATH)
    endpoint = envfile.get("R2_ENDPOINT", "")
    access = envfile.get("R2_ACCESS_KEY_ID", "")
    secret = envfile.get("R2_SECRET_ACCESS_KEY", "")
    bucket = envfile.get("R2_BUCKET_KNOWLEDGE") or envfile.get("R2_BUCKET") or ""
    if not (endpoint and access and secret and bucket):
        print("R2 incompleto, storage local permanece")
        return 0

    atual = sh("docker", "exec", CONTAINER, "printenv", "STORAGE_BACKEND", check=False)
    if atual.returncode == 0 and atual.stdout.strip() == "s3":
        print("storage já está no R2")
        return 0

    inspect = json.loads(sh("docker", "inspect", CONTAINER).stdout)[0]
    env: dict[str, str] = {}
    for item in inspect["Config"]["Env"] or []:
        key, value = item.split("=", 1)
        env[key] = value
    env.update(
        {
            "STORAGE_BACKEND": "s3",
            "GLOBAL_S3_BUCKET": bucket,
            "STORAGE_S3_BUCKET": bucket,
            "GLOBAL_S3_ENDPOINT": endpoint,
            "STORAGE_S3_ENDPOINT": endpoint,
            "GLOBAL_S3_FORCE_PATH_STYLE": "true",
            "STORAGE_S3_FORCE_PATH_STYLE": "true",
            "STORAGE_S3_REGION": "auto",
            "AWS_ACCESS_KEY_ID": access,
            "AWS_SECRET_ACCESS_KEY": secret,
            "AWS_DEFAULT_REGION": "auto",
            "STORAGE_S3_REQUEST_CHECKSUM_CALCULATION": "when_required",
            "STORAGE_S3_RESPONSE_CHECKSUM_VALIDATION": "when_required",
        }
    )
    image = inspect["Config"]["Image"]
    sh("docker", "rename", CONTAINER, f"{CONTAINER}.bak")
    cmd = [
        "docker",
        "run",
        "-d",
        "--name",
        CONTAINER,
        "--network",
        NETWORK,
        "--network-alias",
        "storage",
        "--restart",
        "unless-stopped",
        "-v",
        f"{CONTAINER}:/mnt",
    ]
    for key, value in env.items():
        cmd.extend(["-e", f"{key}={value}"])
    cmd.append(image)
    try:
        sh(*cmd)
    except subprocess.CalledProcessError:
        sh("docker", "rm", "-f", CONTAINER, check=False)
        sh("docker", "rename", f"{CONTAINER}.bak", CONTAINER, check=False)
        sh("docker", "start", CONTAINER, check=False)
        print("não consegui apontar o storage para o R2; o container anterior voltou")
        return 1
    sh("docker", "rm", "-f", f"{CONTAINER}.bak", check=False)
    print("storage apontado para o R2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
