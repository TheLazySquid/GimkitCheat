// rollup.config.js
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import metablock from 'rollup-plugin-userscript-metablock';
import typescript from '@rollup/plugin-typescript';
import { string } from "rollup-plugin-string"
import svg from 'rollup-plugin-svg-import';
import resolve from '@rollup/plugin-node-resolve';

import pkg from './package.json' assert { type: 'json' }
import commonjs from '@rollup/plugin-commonjs';

export default {
	input: 'src/main.ts',
	output: [
		{
			file: 'build/bundle.js',
			format: 'iife'
		},
		{
			file: 'build/bundle.min.js',
			format: 'iife',
			name: 'gc',
			plugins: [ terser() ]
		},
		{
			file: 'build/bundle.user.js',
			format: 'iife',
			name: 'gc',
			plugins: [
				metablock({
					file: './meta.json',
					override: {
						name: pkg.name,
						version: pkg.version,
						description: pkg.description,
						homepage: pkg.homepage,
						author: pkg.author,
						license: pkg.license
					}
				})
			]
		}
	],
	plugins: [
		json(),
		typescript(),
		string({
			include: "**/*.css"
		}),
		svg(),
		resolve({
			browser: true
		}),
		commonjs()
	]
};