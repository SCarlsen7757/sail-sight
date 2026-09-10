FROM timescale/timescaledb-ha:pg18.6-ts2.30.0-all@sha256:b7ae00ed49428f7e5070dc19464e7099f2d855380a5c5c59ca6eeda6689080f2
USER root
# This standalone deployment does not run these optional HA monitoring exporters.
# Their bundled Go runtimes/dependencies carry high/critical advisories.
RUN rm /usr/bin/pgbackrest_exporter /usr/local/bin/pgbouncer_exporter
USER postgres
