FROM timescale/timescaledb-ha:pg18.6-ts2.30.0-all@sha256:b7ae00ed49428f7e5070dc19464e7099f2d855380a5c5c59ca6eeda6689080f2
USER root
# The pinned Ubuntu 22.04 base predates the fix for CVE-2026-84782.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade openssl libssl3 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libssl3)" ge 3.0.2-0ubuntu1.30 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' openssl)" ge 3.0.2-0ubuntu1.30 \
    && rm -rf /var/lib/apt/lists/*
# Standalone PostgreSQL does not invoke the HA exporters or yq YAML utility.
# Their bundled Go runtimes/dependencies carry high/critical advisories.
RUN rm /usr/bin/pgbackrest_exporter /usr/local/bin/pgbouncer_exporter /usr/local/bin/yq
USER postgres
