# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:10.0.12@sha256:222759b391a1aaf241166672c8f99b2d4ada452e7b5319f3c6e8f265a37b5ad4 AS base
USER root
# The pinned base predates the Ubuntu fix for CVE-2026-84782.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade openssl libssl3t64 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libssl3t64)" ge 3.0.13-0ubuntu3.16 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' openssl)" ge 3.0.13-0ubuntu3.16 \
    && rm -rf /var/lib/apt/lists/*
USER $APP_UID
WORKDIR /app
EXPOSE 8080


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:10.0.401@sha256:2fa828c68761b1b8c23d7662dc134421b9d3b59fe1425fdbc80804e390cdb24d AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["SailSight.Api/SailSight.Api.csproj", "SailSight.Api/"]
COPY ["SailSight.Shared/SailSight.Shared.csproj", "SailSight.Shared/"]
RUN dotnet restore "./SailSight.Api/SailSight.Api.csproj"
COPY . .
WORKDIR "/src/SailSight.Api"
RUN dotnet build "./SailSight.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build /p:SkipTypeScriptGeneration=true

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./SailSight.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false /p:SkipTypeScriptGeneration=true

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
USER $APP_UID
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SailSight.Api.dll"]
