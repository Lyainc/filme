/**
 * 자동저장 이미지 영속화(#489) — 포스터(크롭·원본)·체인/포맷 로고·서명 이미지의 Blob을
 * IndexedDB에 저장한다. localStorage(filme:phototicket:v1)는 텍스트·설정 전용(용량 한계로
 * 포스터가 못 들어간다) — 이미지는 별도 스토어에 두되 같은 draft 개념으로 usePhototicket이
 * 함께 저장/복원/삭제한다(부분 복원 방지).
 *
 * dataURL이 아니라 Blob 직접 저장 — captureToImage.ts가 CSP 때문에 fetch(data:)를 피하는 것과
 * 별개로, 여기는 fetch(blob:) 자체가 네트워크를 안 타 문제없다.
 */

export type ImageDbKey = 'poster' | 'posterOriginal' | 'chain' | 'format' | 'signature';

const DB_NAME = 'filme-images';
const STORE = 'images';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 스토어를 통째로 비우고 넘어온 항목만 다시 채운다 — 이번 저장에서 빠진 키(예: 로고 제거)는
 * 곧 사라져야 하므로, 키 단위 delete를 따로 추적하는 것보다 매번 전체를 다시 쓰는 쪽이
 * 더 간단하고 부분 복원 여지도 없다.
 */
export async function saveImages(entries: Partial<Record<ImageDbKey, Blob | undefined>>): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    for (const [key, blob] of Object.entries(entries)) {
      if (blob) store.put(blob, key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadImages(): Promise<Partial<Record<ImageDbKey, Blob>>> {
  const db = await openDb();
  const result = await new Promise<Partial<Record<ImageDbKey, Blob>>>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const out: Partial<Record<ImageDbKey, Blob>> = {};
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out[cursor.key as ImageDbKey] = cursor.value as Blob;
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function clearImages(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
