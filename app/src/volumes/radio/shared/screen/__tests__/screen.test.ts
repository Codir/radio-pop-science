import { describe, expect, it } from 'vitest';
import {
  type DataTexture,
  LinearMipmapLinearFilter,
  NearestFilter,
  NoColorSpace,
  type PlaneGeometry,
  RedFormat,
  type ShaderMaterial,
  UnsignedByteType,
} from 'three';
import { createScreen } from '../screen';

describe('screen', () => {
  const s = createScreen({ width: 0.32, height: 0.24 });
  const u = (s.object.material as ShaderMaterial).uniforms;
  const tex = u.tLuma!.value as DataTexture;

  it('текстура: 128 × 96, один канал; збільшення — найближчий сусід, зменшення — мип-рівні; без колірного простору', () => {
    expect([tex.image.width, tex.image.height, tex.format, tex.type]).toEqual([
      128,
      96,
      RedFormat,
      UnsignedByteType,
    ]);
    expect([
      tex.magFilter,
      tex.minFilter,
      tex.generateMipmaps,
      tex.mipmapsAutoUpdate,
      tex.colorSpace,
    ]).toEqual([NearestFilter, LinearMipmapLinearFilter, true, true, NoColorSpace]);
    expect((s.object.geometry as PlaneGeometry).parameters).toMatchObject({ width: 0.32, height: 0.24 });
  });

  it('текстура оновлюється лише в show', () => {
    const v = tex.version;
    s.power = 0.3;
    expect(u.uPower!.value).toBe(0.3);
    expect(tex.version).toBe(v);
    s.show(new Uint8Array(128 * 96).fill(200));
    expect(tex.version).toBe(v + 1);
    expect(tex.image.data![0]).toBe(200);
    // luma is the texture's data, not a copy
    expect(s.luma).toBe(tex.image.data);
    expect(s.luma).toHaveLength(12288);
    expect(s.luma[0]).toBe(200);
  });
});
