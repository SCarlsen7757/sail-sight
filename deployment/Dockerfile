FROM timescale/timescaledb-ha:pg18.6-ts2.30.0-all@sha256:b7ae00ed49428f7e5070dc19464e7099f2d855380a5c5c59ca6eeda6689080f2
USER root
# The pinned Ubuntu 22.04 base predates the fixes for CVE-2026-84782 (openssl),
# CVE-2026-109518 (apt) and CVE-2026-111497 (brotli).
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade openssl libssl3 apt libbrotli1 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libssl3)" ge 3.0.2-0ubuntu1.30 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' openssl)" ge 3.0.2-0ubuntu1.30 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' apt)" ge 2.4.15ubuntu0.1 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libbrotli1)" ge 1.0.9-2ubuntu0.1 \
    && rm -rf /var/lib/apt/lists/*
# The image ships certifi 2026.7.22, which bundles the compromised emSign root
# CAs (GHSA-6q48-6c7w-9gw2). Upgrade the pip-installed copy in place.
RUN pip3 install --no-cache-dir --upgrade 'certifi>=2026.10.18' \
    && python3 -c "import certifi; assert certifi.__version__ >= '2026.10.18', certifi.__version__"
# Standalone PostgreSQL does not invoke the HA exporters or yq YAML utility.
# Their bundled Go runtimes/dependencies carry high/critical advisories.
RUN rm /usr/bin/pgbackrest_exporter /usr/local/bin/pgbouncer_exporter /usr/local/bin/yq
USER postgres
