# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:10.0.12@sha256:1fe86375600b62e6566b465da9553eef0621f13c67f40fe764cd8dbb1dee1497 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:10.0.401@sha256:4ea6fe75dd36706bb6d8c3c293d4c4315840f5d76ea28ac97def77e3ec487fa5 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["SailSight.Api/SailSight.Api.csproj", "SailSight.Api/"]
COPY ["SailSight.Shared/SailSight.Shared.csproj", "SailSight.Shared/"]
COPY ["Vakaros.Vkx.Parser/Vakaros.Vkx.Parser.csproj", "Vakaros.Vkx.Parser/"]
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