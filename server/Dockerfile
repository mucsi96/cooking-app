# Stage 1: Maven distribution, copied into the native build stage below.
# The GraalVM image ships a JDK but no build tool, and Maven is pure Java, so
# copying it in is cheaper and more predictable than installing it there.
FROM docker.io/library/maven:3-eclipse-temurin-25-alpine AS maven

# Stage 2: Compile the application into a native executable.
# The toolchain is JDK 25 while the project's language level stays at 21: the
# compiler targets 21 via java.version, and 25 is simply the JDK the current
# Liberica NIK release ships.
FROM docker.io/bellsoft/liberica-native-image-kit-container:jdk-25-nik-25-musl AS build

COPY --from=maven /usr/share/maven /usr/share/maven
ENV PATH="/usr/share/maven/bin:${PATH}"

# The Spring profile is resolved during AOT processing and baked into the
# executable, so an image serves exactly one profile. Build one image per
# profile: `test` for the e2e pod, `prod` for the published image.
ARG SPRING_PROFILE=prod

WORKDIR /workspace

# Copy POM and download dependencies (cached separately from source)
COPY pom.xml ./
RUN mvn dependency:go-offline -B -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Copy source code and compile the native executable
COPY native-image.security ./
COPY src ./src
RUN mvn -Pnative native:compile -DskipTests -B \
    -Dapp.profile=${SPRING_PROFILE} \
    -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Stage 3: Runtime image
FROM docker.io/library/alpine:3.23

VOLUME /tmp

# curl is used for health checks, ffmpeg for the webp thumbnails. The
# executable is linked against musl and zlib, both of which Alpine provides -
# but no JRE, which is the point.
RUN apk add --no-cache curl zlib ffmpeg

COPY --from=build /workspace/target/cooking /app/cooking

# There is no JDK in this image, so java.home is unset, and the Azure SDK's JDK
# HTTP client builder dereferences it to read <java.home>/conf/net.properties.
# Point it at an empty file: the JDK ships that property empty by default too,
# and the header allow-list below is what actually matters.
RUN mkdir -p /app/conf && : > /app/conf/net.properties

# An absolute heap cap rather than the percentage of physical memory the default
# uses: the executable's own footprint before any heap is allocated is a
# constant, so the headroom the container needs is one too. 256Mi of heap fits
# the 768Mi limit in scripts/deploy.sh alongside it and the ffmpeg child
# processes, which run outside the heap - keep the three in step. The Azure SDK
# sets Content-Length explicitly on the JDK HTTP client, which the client
# rejects unless the header is allow-listed.
ENTRYPOINT ["/app/cooking", \
    "-XX:MaxHeapSize=256m", \
    "-Djava.home=/app", \
    "-Djdk.httpclient.allowRestrictedHeaders=content-length"]
