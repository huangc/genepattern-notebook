from distutils.core import setup

setup(name='genepattern-notebook',
      py_modules=['genepattern'],
      version='0.3.2',
      description='GenePattern Notebook extension for Jupyter',
      license='BSD',
      author='Thorin Tabor',
      author_email='tabor@broadinstitute.org',
      url='https://github.com/genepattern/genepattern-notebook',
      download_url='https://github.com/genepattern/genepattern-notebook/archive/0.3.1.tar.gz',
      keywords=['genepattern', 'genomics', 'bioinformatics'],
      classifiers=['Framework :: IPython'],
      install_requires=[
          'genepattern-python',
          'ipython',
      ],
)