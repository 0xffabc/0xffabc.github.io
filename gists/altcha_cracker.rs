use sha2::{Sha256, Digest};
use std::time::Instant;
use serde::{Serialize};
use serde_json::{to_string};
use base64::prelude::*;

pub struct AltchaCracker {}
#[derive(Serialize)]
pub struct Message {
    challenge: String,
    salt: String,
    max: u32,
    start: u32,
    signature: String
}

#[derive(Serialize)]
pub struct Payload {
    algorithm: String,
    challenge: String,
    number: u32,
    salt: String,
    signature: String,
    took: u128,
}

impl AltchaCracker {
    pub fn new() -> Self {
        AltchaCracker {}
    }
    
    pub fn hash_challenge(&self, salt: String, num: u32) -> String {
        let mut base_str = salt.to_owned();
        let additional: String = num.to_string().to_owned();
        
        base_str.push_str(&additional);
        
        let mut hasher = Sha256::new();
        hasher.update(base_str);
        format!("{:X}", hasher.finalize())
    }
    
    pub fn solve_challenge(&self, challenge: String, salt: String, max: u32, start: u32) -> u32 {
        let mut crack_num = start;
        let challenge_format: String = challenge.to_uppercase();
        
        loop {
            let hash: String = self.hash_challenge(salt.clone(), crack_num);
            
            if hash == challenge_format || crack_num > max {
                break;
            }
            
            crack_num = crack_num + 1;
        }
        
        crack_num
    }
    
    pub fn generate_token_fnum(&self, msg: Message) -> Payload {
        let timestamp = Instant::now();
        let number_solution: u32 = self.solve_challenge(msg.challenge.clone(), msg.salt.clone(), msg.max, msg.start);
        let took_time = timestamp.elapsed();
        
        let payload: Payload = Payload {
            algorithm: "SHA-256".to_string(),
            challenge: msg.challenge,
            number: number_solution,
            salt: msg.salt,
            signature: msg.signature,
            took: took_time.as_millis()
        };
        
        return payload;
    }
}

fn main() {
    let altcha = AltchaCracker { };
    let msg = Message {
        challenge: "90ab31ba9c714d713aa72b82785235efb2d995eb20682e0d4185bb459f58f8b3".to_owned(),
        max: 500000,
        start: 0,
        salt: "0f2fae07a04d17fa86b597bf".to_owned(),
        signature: "5ccc83c965769ee0b16386ab5fb37d63586e37a2db983039cbc26cc768078d23".to_owned()
    };
    let token_deserialized: Payload = altcha.generate_token_fnum(msg);
    let json_data: String = to_string(&token_deserialized).unwrap();
    let base64_data: String = BASE64_STANDARD.encode(json_data);
    
    println!("{:?}", base64_data);
}
