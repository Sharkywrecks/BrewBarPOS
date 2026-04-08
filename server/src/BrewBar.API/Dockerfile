FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
EXPOSE 5000

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/BrewBar.API/BrewBar.API.csproj", "src/BrewBar.API/"]
COPY ["src/BrewBar.Infrastructure/BrewBar.Infrastructure.csproj", "src/BrewBar.Infrastructure/"]
COPY ["src/BrewBar.Core/BrewBar.Core.csproj", "src/BrewBar.Core/"]
RUN dotnet restore "src/BrewBar.API/BrewBar.API.csproj"
COPY . .
WORKDIR "/src/src/BrewBar.API"
RUN dotnet build "BrewBar.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "BrewBar.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "BrewBar.API.dll"]
