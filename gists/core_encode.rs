pub struct CoreEncode {
    buffer: Vec<u8>,
}

pub enum Lengths {
    U8(u8),
    U16(u16),
    U32(u32),
}

pub enum SupportedNumbers {
    // F16(f16),
    F32(f32),
    F64(f64),
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    U128(u128),
    
    I8(i8),
    I16(i16),
    I32(i32),
    I64(i64),
    I128(i128)
}

impl CoreEncode {
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
        }
    }

    pub fn write(&mut self, bytes: Vec<u8>) {
        self.buffer.extend(bytes);
    }

    pub fn start_arr(&mut self, length: Lengths) -> &mut Self {
        match length {
            Lengths::U8(len) => {
                if len < 15 {
                    self.write(vec![0x90 + len]);
                } else {
                    self.write(vec![0xdc, 0x00, len]);
                }
            }
            Lengths::U16(len) => {
                self.write(vec![
                    0xdc, 
                    (len >> 8) as u8,
                    len as u8
                ]);
            }
            Lengths::U32(len) => {
                self.write(vec![
                    0xdd, 
                    (len >> 24) as u8,
                    (len >> 16) as u8,
                    (len >> 8) as u8,
                    len as u8
                ]);
            }
        }
        
        self
    }
    
    pub fn start_map(&mut self, length: Lengths) -> &mut Self {
        match length {
            Lengths::U8(len) => {
                if len < 15 {
                    self.write(vec![0x80 + len]);
                } else {
                    self.write(vec![0xde, 0x00, len]);
                }
            }
            Lengths::U16(len) => {
                self.write(vec![
                    0xde, 
                    (len >> 8) as u8,
                    len as u8
                ]);
            }
            Lengths::U32(len) => {
                self.write(vec![
                    0xdf, 
                    (len >> 24) as u8,
                    (len >> 16) as u8,
                    (len >> 8) as u8,
                    len as u8
                ]);
            }
        }
        
        self
    }
    
    pub fn string(&mut self, _str: String) -> &mut Self {
        let bytes: Vec<u8> = _str.into_bytes();
        let length = bytes.len();
        
        match length {
            len if len <= 0xFF => {
                self.write(vec![0xd9, len as u8]);
                self.write(bytes);
            }
            len if len <= 0xFFFF => {
                let len_bytes = len.to_be_bytes();
                self.write(vec![0xda]);
                self.write(len_bytes.to_vec());
                self.write(bytes);
            }
            len if len <= 0xFFFFFFFF => {
                let len_bytes = len.to_be_bytes();
                self.write(vec![0xdb]);
                self.write(len_bytes.to_vec());
                self.write(bytes);
            }
            0_usize.. => todo!()
        }
        
        self
    }
    
    pub fn number(&mut self, _number: SupportedNumbers) -> &mut Self {
        match _number {
            SupportedNumbers::U8(num) => {
                self.write(vec![0xcc]);
                self.write(vec![num]);
            }
            SupportedNumbers::I8(num) => {
                self.write(vec![0xd0]);
                self.write(vec![num as u8]);
            }
            SupportedNumbers::F32(num) => {
                self.write(vec![0xca]);
                self.write(num.to_be_bytes().to_vec());
            }
            SupportedNumbers::F64(num) => {
                self.write(vec![0xcb]);
                self.write(num.to_be_bytes().to_vec());
            }
            SupportedNumbers::U16(num) => {
                self.write(vec![0xcd]);
                self.write(num.to_le_bytes().to_vec());
            }
            SupportedNumbers::U32(num) => {
                self.write(vec![0xce]);
                self.write(num.to_le_bytes().to_vec());
            }
            SupportedNumbers::U64(num) => {
                self.write(vec![0xcf]);
                self.write(num.to_le_bytes().to_vec());
            }
            SupportedNumbers::U128(num) => self.write(num.to_le_bytes().to_vec()),
            SupportedNumbers::I16(num) => {
                self.write(vec![0xd1]);
                self.write(num.to_le_bytes().to_vec());
            }
            SupportedNumbers::I32(num) => {
                self.write(vec![0xd2]);
                self.write(num.to_le_bytes().to_vec());
            }
            SupportedNumbers::I64(num) => {
                self.write(vec![0xd3]);
                self.write(num.to_le_bytes().to_vec());
            }
            SupportedNumbers::I128(num) => self.write(num.to_le_bytes().to_vec()),
        }
    
        self
    }
}

fn main() {
    let mut _encoder: CoreEncode = CoreEncode { buffer: vec![] };
    
    _encoder.start_arr(Lengths::U8(2u8))
        .string("hi".to_owned())
        .start_map(Lengths::U8(3u8))
        .string("a".to_owned())
        .string("op packer".to_owned())
        .string("flarez rusting".to_owned())
        .number(SupportedNumbers::F32(1.23f32))
        .string("wow savege so tall only 4'3".to_owned())
        .number(SupportedNumbers::F64(14.78420f64));
    
    println!("{:?}", _encoder.buffer);
}
