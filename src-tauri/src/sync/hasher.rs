use std::fs::File;
use std::io::{Read, Result as IoResult};
use std::path::Path;
use md5;
use sha2::{Sha256, Digest};
use crate::sync::{HashAlgorithm, SyncEvent};

pub struct FileHasher;

impl FileHasher {
    /// Compute MD5 hash of a file
    pub fn hash_file_md5<P: AsRef<Path>>(path: P) -> IoResult<String> {
        let mut file = File::open(path)?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents)?;
        
        let digest = md5::compute(&contents);
        Ok(format!("{:x}", digest))
    }

    /// Compute SHA256 hash of a file
    pub fn hash_file_sha256<P: AsRef<Path>>(path: P) -> IoResult<String> {
        let mut file = File::open(path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0; 8192];

        loop {
            let count = file.read(&mut buffer)?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }

        Ok(format!("{:x}", hasher.finalize()))
    }

    /// Compute hash based on algorithm type
    pub fn hash_file<P: AsRef<Path>>(path: P, algorithm: &HashAlgorithm) -> IoResult<String> {
        match algorithm {
            HashAlgorithm::MD5 => Self::hash_file_md5(path),
            HashAlgorithm::SHA256 => Self::hash_file_sha256(path),
        }
    }

    /// Verify file integrity
    pub fn verify_file<P: AsRef<Path>>(
        path: P,
        expected_hash: &str,
        algorithm: &HashAlgorithm,
    ) -> IoResult<bool> {
        let computed_hash = Self::hash_file(&path, algorithm)?;
        Ok(computed_hash == expected_hash)
    }

    /// Compare two files for equality
    pub fn files_are_identical<P: AsRef<Path>>(
        path1: P,
        path2: P,
        algorithm: &HashAlgorithm,
    ) -> IoResult<bool> {
        let hash1 = Self::hash_file(&path1, algorithm)?;
        let hash2 = Self::hash_file(&path2, algorithm)?;
        Ok(hash1 == hash2)
    }

    /// Get file size
    pub fn get_file_size<P: AsRef<Path>>(path: P) -> IoResult<u64> {
        Ok(std::fs::metadata(path)?.len())
    }

    /// Compute both hash and size
    pub fn compute_file_metadata<P: AsRef<Path>>(
        path: P,
        algorithm: &HashAlgorithm,
    ) -> IoResult<(String, u64)> {
        let hash = Self::hash_file(&path, algorithm)?;
        let size = Self::get_file_size(&path)?;
        Ok((hash, size))
    }
}