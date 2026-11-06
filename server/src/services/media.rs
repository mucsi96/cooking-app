use anyhow::ensure;
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
use tokio::{fs, process::Command};
use uuid::Uuid;

pub const MAX_PHOTO_BYTES: usize = 15 * 1024 * 1024;

fn supported(data: &[u8]) -> bool {
    [
        b"\xff\xd8\xff".as_slice(),
        b"\x89PNG\r\n\x1a\n",
        b"GIF87a",
        b"GIF89a",
        b"BM",
    ]
    .iter()
    .any(|prefix| data.starts_with(prefix))
        || (data.len() >= 12
            && ((&data[..4] == b"RIFF" && &data[8..12] == b"WEBP")
                || (&data[4..8] == b"ftyp"
                    && [
                        b"avif", b"avis", b"heic", b"heix", b"heim", b"heis", b"hevc", b"hevx",
                        b"mif1", b"msf1",
                    ]
                    .contains(&data[8..12].try_into().unwrap()))))
}

pub async fn convert(data: &[u8], format: &str) -> anyhow::Result<Vec<u8>> {
    ensure!(supported(data), "unsupported image format");
    let dir = tempfile::tempdir()?;
    let input = dir.path().join("input");
    let output = dir.path().join(format!("output.{format}"));
    fs::write(&input, data).await?;
    let mut cmd = Command::new("ffmpeg");
    cmd.kill_on_drop(true)
        .args([
            "-nostdin",
            "-y",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "file",
            "-max_pixels",
            "25000000",
            "-i",
        ])
        .arg(input)
        .args(["-frames:v", "1", "-threads", "1"]);
    if format == "jpg" {
        cmd.args(["-vf","scale=w='min(1568,iw)':h='min(1568,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2","-c:v","mjpeg","-q:v","3","-pix_fmt","yuvj420p"]);
    } else {
        cmd.args([
            "-vf",
            "scale=1200:1200:force_original_aspect_ratio=decrease",
            "-c:v",
            "libwebp",
            "-quality",
            "75",
        ]);
    }
    let result = tokio::time::timeout(Duration::from_secs(30), cmd.arg(&output).output()).await??;
    ensure!(result.status.success(), "image conversion failed");
    Ok(fs::read(output).await?)
}

pub fn image_path(directory: &str, id: Uuid) -> PathBuf {
    Path::new(directory)
        .join("images")
        .join(format!("{id}.webp"))
}

pub async fn save(directory: &str, id: Uuid, data: &[u8]) -> anyhow::Result<()> {
    let image = convert(data, "webp").await?;
    let file = tempfile::NamedTempFile::new_in(Path::new(directory).join("images"))?;
    fs::write(file.path(), image).await?;
    file.as_file().sync_all()?;
    file.persist(image_path(directory, id))?;
    Ok(())
}
