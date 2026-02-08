import bcrypt from "bcryptjs";

const SEED_STUDENTS = [
  { nim: "10123456", name: "Mahasiswa 10123456", password: "mahasiswa123", status: "ACTIVE" },
  { nim: "10123457", name: "Mahasiswa 10123457", password: "mahasiswa123", status: "ACTIVE" },
  { nim: "10123458", name: "Mahasiswa 10123458", password: "mahasiswa123", status: "ACTIVE" },
  { nim: "10123459", name: "Mahasiswa 10123459", password: "mahasiswa123", status: "ACTIVE" }
];

const students = new Map(
  SEED_STUDENTS.map((item) => [
    item.nim,
    {
      nim: item.nim,
      name: item.name,
      status: item.status,
      passwordHash: bcrypt.hashSync(item.password, 10)
    }
  ])
);

export function listStudents() {
  return Array.from(students.values()).map(({ passwordHash, ...rest }) => rest);
}

export function getStudent(nim) {
  const student = students.get(nim);
  if (!student) return null;
  const { passwordHash, ...rest } = student;
  return rest;
}

export async function verifyStudentCredentials(nim, password) {
  const student = students.get(nim);
  if (!student || student.status !== "ACTIVE") {
    return null;
  }
  const valid = await bcrypt.compare(password, student.passwordHash);
  if (!valid) return null;
  const { passwordHash, ...rest } = student;
  return rest;
}

export async function changeStudentPassword(nim, newPassword) {
  const student = students.get(nim);
  if (!student || student.status !== "ACTIVE") {
    return false;
  }
  student.passwordHash = await bcrypt.hash(newPassword, 10);
  students.set(nim, student);
  return true;
}
